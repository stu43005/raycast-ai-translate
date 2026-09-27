import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  getSelectedText,
  Icon,
  Keyboard,
  LaunchProps,
  List,
  openExtensionPreferences,
} from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { createHash } from "crypto";
import { ReactNode, useEffect, useRef, useState } from "react";
import { TranslationState, useTranslation } from "./hooks/useTranslation";
import { findEntry, HistoryEntry, removeEntry, upsertEntry } from "./lib/history";
import { AUTO_DETECT, getLanguageTitle, SOURCE_LANGUAGES, TARGET_LANGUAGES } from "./lib/languages";
import { toLiteralMarkdown } from "./lib/layout";
import { getDebounceMs, getModel, getPreferences, getProviderOptions, getTimeoutMs } from "./lib/preferences";
import { TRANSLATE_MODES, TranslateMode } from "./lib/prompt";
import { getProvider, ProviderId, PROVIDERS } from "./lib/providers";
import { resolveLanguages } from "./lib/resolve";
import { CliNotFoundError } from "./lib/runner";

const HISTORY_CACHE_KEY = "translation-history";
const CURRENT_ITEM_ID = "current";

/** Modes whose output is Markdown by design; other results are rendered literally. */
const MARKDOWN_MODES: TranslateMode[] = ["analyze", "explain-code"];

function providerLabel(provider: ProviderId, model?: string): string {
  const title = getProvider(provider).title;
  return model?.trim() ? `${title} (${model.trim()})` : title;
}

function modeTitle(mode: TranslateMode): string {
  return TRANSLATE_MODES.find((item) => item.id === mode)?.title ?? mode;
}

function singleLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function historyItemId(entry: HistoryEntry): string {
  return `history-${createHash("sha1").update(entry.key).digest("hex").slice(0, 16)}`;
}

function errorMarkdown(error: Error, provider: ProviderId): string {
  const info = getProvider(provider);
  if (error instanceof CliNotFoundError) {
    return [
      `## ${info.title} not found`,
      `Could not find the \`${error.command}\` command on your PATH.`,
      `Install it with \`${info.installHint}\`, sign in once from a terminal, or set **CLI Path Override** in the extension preferences.`,
    ].join("\n\n");
  }
  return [`## Translation failed`, "```", error.message, "```"].join("\n\n");
}

/** Translation on top, source text below a separator. */
function recordMarkdown(result: string, source: string, mode: TranslateMode): string {
  const translation = MARKDOWN_MODES.includes(mode) ? result : toLiteralMarkdown(result);
  return `${translation}\n\n---\n\n${toLiteralMarkdown(source)}`;
}

function currentMarkdown(state: TranslationState, text: string, provider: ProviderId, mode: TranslateMode): string {
  if (state.error) {
    return errorMarkdown(state.error, provider);
  }
  if (!state.text) {
    const placeholder = state.isLoading ? "_Translating…_" : "_Press ⏎ to translate._";
    return `${placeholder}\n\n---\n\n${toLiteralMarkdown(text)}`;
  }
  return recordMarkdown(state.text, text, mode);
}

export default function Command(props: LaunchProps<{ arguments: { text?: string } }>) {
  const preferences = getPreferences();
  const initialText = props.arguments.text?.trim() || props.fallbackText?.trim() || "";

  const [text, setText] = useState(initialText);
  const [sourceLang, setSourceLang] = useCachedState("source-language", AUTO_DETECT);
  const [targetLang, setTargetLang] = useCachedState("target-language", preferences.defaultTargetLanguage || "zh-Hant");
  const [mode, setMode] = useCachedState<TranslateMode>("mode", "translate");
  const [provider, setProvider] = useState<ProviderId>(preferences.provider || "claude");
  const [history, setHistory] = useCachedState<HistoryEntry[]>(HISTORY_CACHE_KEY, []);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialText ? CURRENT_ITEM_ID : undefined);
  const userTyped = useRef(initialText.length > 0);

  const changeText = (value: string) => {
    userTyped.current = true;
    setText(value);
    setSelectedId(CURRENT_ITEM_ID);
  };

  // Prefill with the frontmost app's selection, unless the user already started typing.
  useEffect(() => {
    if (!preferences.useSelectedText || userTyped.current) return;
    getSelectedText()
      .then((selected) => {
        if (!userTyped.current && selected.trim()) changeText(selected.trim());
      })
      .catch(() => undefined);
  }, []);

  const resolved = resolveLanguages({
    text,
    source: sourceLang,
    target: targetLang,
    secondTarget: preferences.secondTargetLanguage || "en",
    mode,
  });
  const model = getModel(preferences, provider);
  const translation = useTranslation(
    {
      text,
      source: resolved.source,
      target: resolved.target,
      mode,
      provider,
      options: getProviderOptions(preferences, provider),
    },
    {
      auto: preferences.autoTranslate,
      debounceMs: getDebounceMs(preferences),
      timeoutMs: getTimeoutMs(preferences),
      // Identical text and options: reuse the saved translation instead of calling the CLI again.
      lookup: (key) => {
        const entry = findEntry(history, key);
        return entry && { text: entry.result, isWordMode: entry.isWordMode, elapsedMs: entry.elapsedMs };
      },
      onComplete: (key, request, result) =>
        setHistory((previous) =>
          upsertEntry(previous, {
            key,
            text: request.text.trim(),
            source: request.source,
            target: request.target,
            mode: request.mode,
            provider: request.provider,
            model: request.options.model?.trim() || undefined,
            result: result.text,
            isWordMode: result.isWordMode,
            elapsedMs: result.elapsedMs,
            createdAt: Date.now(),
          }),
        ),
    },
  );

  const hasText = text.trim().length > 0;
  const result = !translation.isLoading && !translation.error ? translation.text : "";
  const sourceTitle = `${getLanguageTitle(resolved.source)}${resolved.sourceDetected ? " (detected)" : ""}`;
  const targetTitle = getLanguageTitle(resolved.target);
  // The current request's own history entry is shown as the current item, not twice.
  const historyItems = history.filter((entry) => !hasText || entry.key !== translation.key);

  const swapLanguages = () => {
    const nextSource = SOURCE_LANGUAGES.some((language) => language.code === resolved.target)
      ? resolved.target
      : AUTO_DETECT;
    setSourceLang(nextSource);
    setTargetLang(resolved.source);
    if (result) changeText(result);
  };

  const loadEntry = (entry: HistoryEntry) => {
    setSourceLang(entry.source);
    setTargetLang(entry.target);
    setMode(entry.mode);
    setProvider(entry.provider);
    changeText(entry.text);
  };

  const deleteEntry = (entry: HistoryEntry) => setHistory((previous) => removeEntry(previous, entry.key));

  const clearHistory = async () => {
    const confirmed = await confirmAlert({
      title: "Clear Translation History?",
      message: `All ${history.length} saved translations will be removed.`,
      primaryAction: { title: "Clear History", style: Alert.ActionStyle.Destructive },
    });
    if (confirmed) setHistory([]);
  };

  const settingsSections = (
    <>
      <ActionPanel.Section title="Languages">
        <Action
          title="Swap Languages"
          icon={Icon.Switch}
          shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
          onAction={swapLanguages}
        />
        <ActionPanel.Submenu
          title="Change Source Language"
          icon={Icon.Microphone}
          shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
        >
          {[AUTO_DETECT, ...SOURCE_LANGUAGES.map((language) => language.code)].map((code) => (
            <Action
              key={code}
              title={getLanguageTitle(code)}
              icon={code === sourceLang ? Icon.CheckCircle : Icon.Circle}
              onAction={() => setSourceLang(code)}
            />
          ))}
        </ActionPanel.Submenu>
        <ActionPanel.Submenu
          title="Change Target Language"
          icon={Icon.Globe}
          shortcut={{ modifiers: ["cmd"], key: "l" }}
        >
          {TARGET_LANGUAGES.map((language) => (
            <Action
              key={language.code}
              title={getLanguageTitle(language.code)}
              icon={language.code === targetLang ? Icon.CheckCircle : Icon.Circle}
              onAction={() => setTargetLang(language.code)}
            />
          ))}
        </ActionPanel.Submenu>
      </ActionPanel.Section>
      <ActionPanel.Section title="Engine">
        <ActionPanel.Submenu title="Change Mode" icon={Icon.Wand} shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}>
          {TRANSLATE_MODES.map((item) => (
            <Action
              key={item.id}
              title={item.title}
              icon={item.id === mode ? Icon.CheckCircle : Icon.Circle}
              onAction={() => setMode(item.id)}
            />
          ))}
        </ActionPanel.Submenu>
        <ActionPanel.Submenu
          title="Change AI CLI"
          icon={Icon.Terminal}
          shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
        >
          {PROVIDERS.map((item) => (
            <Action
              key={item.id}
              title={item.title}
              icon={item.id === provider ? Icon.CheckCircle : Icon.Circle}
              onAction={() => setProvider(item.id)}
            />
          ))}
        </ActionPanel.Submenu>
        <Action
          title="Open Extension Preferences"
          icon={Icon.Gear}
          shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
          onAction={openExtensionPreferences}
        />
      </ActionPanel.Section>
    </>
  );

  const clearHistoryAction =
    history.length > 0 ? (
      <Action
        title="Clear History"
        icon={Icon.Trash}
        style={Action.Style.Destructive}
        shortcut={Keyboard.Shortcut.Common.RemoveAll}
        onAction={clearHistory}
      />
    ) : null;

  const actionPanel = (primary: ReactNode, entryAction: ReactNode) => (
    <ActionPanel>
      <ActionPanel.Section>{primary}</ActionPanel.Section>
      {settingsSections}
      <ActionPanel.Section title="History">
        {entryAction}
        {clearHistoryAction}
      </ActionPanel.Section>
    </ActionPanel>
  );

  const currentActions = actionPanel(
    <>
      {result ? (
        <>
          <Action.CopyToClipboard title="Copy Translation" content={result} />
          <Action.Paste title="Paste Translation" content={result} />
        </>
      ) : null}
      {hasText ? (
        <Action
          title={result || translation.error ? "Retranslate" : "Translate"}
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={translation.translate}
        />
      ) : null}
      {hasText ? (
        <Action.CopyToClipboard title="Copy Source Text" content={text} shortcut={Keyboard.Shortcut.Common.Copy} />
      ) : null}
    </>,
    null,
  );

  const historyActions = (entry: HistoryEntry) =>
    actionPanel(
      <>
        <Action.CopyToClipboard title="Copy Translation" content={entry.result} />
        <Action.Paste title="Paste Translation" content={entry.result} />
        <Action
          title="Load into Input"
          icon={Icon.Pencil}
          shortcut={Keyboard.Shortcut.Common.Edit}
          onAction={() => loadEntry(entry)}
        />
        <Action.CopyToClipboard
          title="Copy Source Text"
          content={entry.text}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
      </>,
      <Action
        title="Delete Entry"
        icon={Icon.Trash}
        style={Action.Style.Destructive}
        shortcut={Keyboard.Shortcut.Common.Remove}
        onAction={() => deleteEntry(entry)}
      />,
    );

  const currentDetail = (
    <List.Item.Detail
      isLoading={translation.isLoading}
      markdown={currentMarkdown(translation, text, provider, mode)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Source" text={sourceTitle} />
          <List.Item.Detail.Metadata.Label
            title="Target"
            text={resolved.targetSwitched ? `${targetTitle} (switched from source)` : targetTitle}
            icon={Icon.Globe}
          />
          <List.Item.Detail.Metadata.Label title="Mode" text={modeTitle(mode)} />
          <List.Item.Detail.Metadata.Label title="Engine" text={providerLabel(provider, model)} icon={Icon.Terminal} />
          {result && translation.elapsedMs !== undefined ? (
            <List.Item.Detail.Metadata.Label
              title="Time"
              text={
                translation.fromHistory
                  ? `${(translation.elapsedMs / 1000).toFixed(1)}s (reused from history)`
                  : `${(translation.elapsedMs / 1000).toFixed(1)}s`
              }
            />
          ) : null}
          {translation.error ? (
            <List.Item.Detail.Metadata.Label title="Status" text={{ value: "Failed", color: Color.Red }} />
          ) : null}
        </List.Item.Detail.Metadata>
      }
    />
  );

  const historyDetail = (entry: HistoryEntry) => (
    <List.Item.Detail
      markdown={recordMarkdown(entry.result, entry.text, entry.mode)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Source" text={getLanguageTitle(entry.source)} />
          <List.Item.Detail.Metadata.Label title="Target" text={getLanguageTitle(entry.target)} icon={Icon.Globe} />
          <List.Item.Detail.Metadata.Label title="Mode" text={modeTitle(entry.mode)} />
          <List.Item.Detail.Metadata.Label
            title="Engine"
            text={providerLabel(entry.provider, entry.model)}
            icon={Icon.Terminal}
          />
          <List.Item.Detail.Metadata.Label title="Time" text={`${(entry.elapsedMs / 1000).toFixed(1)}s`} />
          <List.Item.Detail.Metadata.Label title="Translated" text={new Date(entry.createdAt).toLocaleString()} />
        </List.Item.Detail.Metadata>
      }
    />
  );

  const currentIcon = translation.error
    ? { source: Icon.Warning, tintColor: Color.Red }
    : translation.isLoading
      ? Icon.CircleProgress50
      : Icon.Pencil;

  return (
    <List
      isShowingDetail={hasText || historyItems.length > 0}
      isLoading={translation.isLoading}
      searchText={text}
      onSearchTextChange={changeText}
      searchBarPlaceholder={`Translate to ${targetTitle}…`}
      selectedItemId={selectedId}
      onSelectionChange={(id) => setSelectedId(id ?? undefined)}
      searchBarAccessory={
        <List.Dropdown tooltip="Target Language" value={targetLang} onChange={setTargetLang}>
          <List.Dropdown.Section title="Target Language">
            {TARGET_LANGUAGES.map((language) => (
              <List.Dropdown.Item
                key={language.code}
                value={language.code}
                title={getLanguageTitle(language.code)}
                keywords={[language.code, language.name, language.nameEn]}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      actions={currentActions}
    >
      <List.EmptyView
        icon={Icon.Globe}
        title="Type something to translate"
        description={`${getLanguageTitle(sourceLang)} → ${getLanguageTitle(targetLang)} · ${providerLabel(provider, model)}`}
        actions={currentActions}
      />
      {hasText ? (
        <List.Section title={`${sourceTitle} → ${targetTitle}`}>
          <List.Item
            id={CURRENT_ITEM_ID}
            icon={currentIcon}
            title={{ value: singleLine(text), tooltip: text }}
            detail={currentDetail}
            actions={currentActions}
          />
        </List.Section>
      ) : null}
      {historyItems.length > 0 ? (
        <List.Section title="History" subtitle={String(historyItems.length)}>
          {historyItems.map((entry) => (
            <List.Item
              key={entry.key}
              id={historyItemId(entry)}
              icon={Icon.Clock}
              title={{ value: singleLine(entry.text), tooltip: `${entry.text}\n→ ${entry.result}` }}
              detail={historyDetail(entry)}
              actions={historyActions(entry)}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}
