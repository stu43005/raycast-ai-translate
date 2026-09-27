import {
  Action,
  ActionPanel,
  Color,
  getSelectedText,
  Icon,
  Keyboard,
  LaunchProps,
  List,
  openExtensionPreferences,
} from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { TranslationState, useTranslation } from "./hooks/useTranslation";
import { AUTO_DETECT, getLanguageTitle, SOURCE_LANGUAGES, TARGET_LANGUAGES } from "./lib/languages";
import { toLiteralMarkdown, wrapText } from "./lib/layout";
import { getDebounceMs, getModel, getPreferences, getProviderOptions, getTimeoutMs } from "./lib/preferences";
import { TRANSLATE_MODES, TranslateMode } from "./lib/prompt";
import { getProvider, ProviderId, PROVIDERS } from "./lib/providers";
import { resolveLanguages } from "./lib/resolve";
import { CliNotFoundError } from "./lib/runner";

/** Approximate width of the list column (in half-width characters) when the detail pane is shown. */
const SOURCE_COLUMN_WIDTH = 30;

/** Modes whose output is Markdown by design; other results are rendered literally. */
const MARKDOWN_MODES: TranslateMode[] = ["analyze", "explain-code"];

function providerLabel(provider: ProviderId, model?: string): string {
  const title = getProvider(provider).title;
  return model?.trim() ? `${title} (${model.trim()})` : title;
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

function detailMarkdown(state: TranslationState, provider: ProviderId, mode: TranslateMode): string {
  if (state.error) {
    return errorMarkdown(state.error, provider);
  }
  if (!state.text) {
    return state.isLoading ? "_Translating…_" : "_Press ⏎ to translate._";
  }
  return MARKDOWN_MODES.includes(mode) ? state.text : toLiteralMarkdown(state.text);
}

export default function Command(props: LaunchProps<{ arguments: { text?: string } }>) {
  const preferences = getPreferences();
  const initialText = props.arguments.text?.trim() || props.fallbackText?.trim() || "";

  const [text, setText] = useState(initialText);
  const [sourceLang, setSourceLang] = useCachedState("source-language", AUTO_DETECT);
  const [targetLang, setTargetLang] = useCachedState("target-language", preferences.defaultTargetLanguage || "zh-Hant");
  const [mode, setMode] = useCachedState<TranslateMode>("mode", "translate");
  const [provider, setProvider] = useState<ProviderId>(preferences.provider || "claude");
  const userTyped = useRef(initialText.length > 0);

  // Prefill with the frontmost app's selection, unless the user already started typing.
  useEffect(() => {
    if (!preferences.useSelectedText || userTyped.current) return;
    getSelectedText()
      .then((selected) => {
        if (!userTyped.current && selected.trim()) setText(selected.trim());
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
    },
  );

  const hasText = text.trim().length > 0;
  const result = !translation.isLoading && !translation.error ? translation.text : "";
  const sourceTitle = `${getLanguageTitle(resolved.source)}${resolved.sourceDetected ? " — Detected" : ""}`;
  const targetTitle = getLanguageTitle(resolved.target);
  const modeTitle = TRANSLATE_MODES.find((item) => item.id === mode)?.title ?? mode;

  const swapLanguages = () => {
    const nextSource = SOURCE_LANGUAGES.some((language) => language.code === resolved.target)
      ? resolved.target
      : AUTO_DETECT;
    setSourceLang(nextSource);
    setTargetLang(resolved.source);
    if (result) {
      userTyped.current = true;
      setText(result);
    }
  };

  const detail = (
    <List.Item.Detail
      isLoading={translation.isLoading}
      markdown={detailMarkdown(translation, provider, mode)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label
            title="Target"
            text={resolved.targetSwitched ? `${targetTitle} (switched from source)` : targetTitle}
            icon={Icon.Globe}
          />
          <List.Item.Detail.Metadata.Label title="Mode" text={modeTitle} />
          <List.Item.Detail.Metadata.Label title="Engine" text={providerLabel(provider, model)} icon={Icon.Terminal} />
          {translation.elapsedMs !== undefined && !translation.isLoading && !translation.error ? (
            <List.Item.Detail.Metadata.Label title="Time" text={`${(translation.elapsedMs / 1000).toFixed(1)}s`} />
          ) : null}
          {translation.error ? (
            <List.Item.Detail.Metadata.Label title="Status" text={{ value: "Failed", color: Color.Red }} />
          ) : null}
        </List.Item.Detail.Metadata>
      }
    />
  );

  const actions = (
    <ActionPanel>
      <ActionPanel.Section>
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
      </ActionPanel.Section>
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
    </ActionPanel>
  );

  const sourceLines = wrapText(text, SOURCE_COLUMN_WIDTH);

  return (
    <List
      isShowingDetail={hasText}
      isLoading={translation.isLoading}
      searchText={text}
      onSearchTextChange={(value) => {
        userTyped.current = true;
        setText(value);
      }}
      searchBarPlaceholder={`Translate to ${targetTitle}…`}
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
      actions={actions}
    >
      <List.EmptyView
        icon={Icon.Globe}
        title="Type something to translate"
        description={`${getLanguageTitle(sourceLang)} → ${getLanguageTitle(targetLang)} · ${providerLabel(provider, model)}`}
        actions={actions}
      />
      {hasText ? (
        <List.Section title={`Source · ${sourceTitle}`}>
          {sourceLines.map((line, index) => (
            <List.Item
              key={`${index}:${line}`}
              id={`source-${index}`}
              title={line || " "}
              detail={detail}
              actions={actions}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}
