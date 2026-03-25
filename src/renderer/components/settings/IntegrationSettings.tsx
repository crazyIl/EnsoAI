import type { AiApiProtocol, AiProviderMode } from '@shared/types';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import { defaultBranchNameGeneratorSettings, useSettingsStore } from '@/stores/settings';
import { ProviderList } from './claude-provider';
import { KeybindingInput } from './KeybindingsSettings';
import { ModelCombobox } from './ModelCombobox';
import { McpSection } from './mcp';
import { PluginsSection } from './plugins';
import { PromptsSection } from './prompts';

const PROVIDER_MODES: { value: AiProviderMode; label: string }[] = [
  { value: 'cli', label: 'CLI' },
  { value: 'api', label: 'AI API' },
];

const API_PROTOCOLS: { value: AiApiProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
];

function getApiBaseUrlPlaceholder(protocol: AiApiProtocol): string {
  return protocol === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1';
}

export function IntegrationSettings() {
  const { t } = useI18n();
  const {
    claudeCodeIntegration,
    setClaudeCodeIntegration,
    commitMessageGenerator,
    setCommitMessageGenerator,
    codeReview,
    setCodeReview,
    branchNameGenerator,
    setBranchNameGenerator,
    thirdPartyAiConfig,
    setThirdPartyAiConfig,
  } = useSettingsStore();
  const [bridgePort, setBridgePort] = React.useState<number | null>(null);
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  const debounceOptions = React.useMemo(
    () =>
      [100, 200, 300, 500, 1000].map((value) => ({
        value,
        label: `${value}ms`,
      })),
    []
  );

  // Fetch bridge status on mount and when enabled changes
  React.useEffect(() => {
    if (claudeCodeIntegration.enabled) {
      window.electronAPI.mcp.getStatus().then((status) => {
        setBridgePort(status.port);
      });
    } else {
      setBridgePort(null);
    }
  }, [claudeCodeIntegration.enabled]);

  const handleEnabledChange = (checked: boolean) => {
    // Just update the settings - App.tsx useEffect will handle the bridge
    setClaudeCodeIntegration({ enabled: checked });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('Claude Code Integration')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('Connect to Claude Code CLI for enhanced IDE features')}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-sm font-medium">{t('Enable Integration')}</span>
          <p className="text-xs text-muted-foreground">
            {t('Start WebSocket server for Claude Code connection')}
            {bridgePort && ` (Port: ${bridgePort})`}
          </p>
        </div>
        <Switch checked={claudeCodeIntegration.enabled} onCheckedChange={handleEnabledChange} />
      </div>

      {claudeCodeIntegration.enabled && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Selection Changed Debounce */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('Debounce Time')}</span>
            <div className="space-y-1.5">
              <Select
                value={String(claudeCodeIntegration.selectionChangedDebounce)}
                onValueChange={(v) =>
                  setClaudeCodeIntegration({ selectionChangedDebounce: Number(v) })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue>{claudeCodeIntegration.selectionChangedDebounce}ms</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {debounceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('Delay before sending selection changes to Claude Code')}
              </p>
            </div>
          </div>

          {/* At Mentioned Keybinding */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <span className="text-sm font-medium mt-2">{t('Mention Shortcut')}</span>
            <div className="space-y-1.5">
              <KeybindingInput
                value={claudeCodeIntegration.atMentionedKeybinding}
                onChange={(binding) => setClaudeCodeIntegration({ atMentionedKeybinding: binding })}
              />
              <p className="text-xs text-muted-foreground">
                {t('Send selected code range to Claude Code')}
              </p>
            </div>
          </div>

          {/* Stop Hook (Enhanced Notification) */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">{t('Enhanced Notification')}</span>
              <p className="text-xs text-muted-foreground">
                {t('Use Claude Stop hook for precise agent completion notifications')}
              </p>
            </div>
            <Switch
              checked={claudeCodeIntegration.stopHookEnabled}
              onCheckedChange={(checked) => setClaudeCodeIntegration({ stopHookEnabled: checked })}
            />
          </div>

          {/* Status Line */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">{t('Status Line')}</span>
              <p className="text-xs text-muted-foreground">
                {t('Show agent status (model, context, cost) at bottom of terminal')}
              </p>
            </div>
            <Switch
              checked={claudeCodeIntegration.statusLineEnabled}
              onCheckedChange={(checked) =>
                setClaudeCodeIntegration({ statusLineEnabled: checked })
              }
            />
          </div>

          {/* Status Line Fields */}
          {claudeCodeIntegration.statusLineEnabled && (
            <div className="ml-4 space-y-2 border-l-2 border-muted pl-4">
              <span className="text-xs font-medium text-muted-foreground">
                {t('Display Fields')}
              </span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.model ?? true}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          model: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Model')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.context ?? true}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          context: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Context')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.cost ?? true}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          cost: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Cost')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.duration ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          duration: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Duration')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.lines ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          lines: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Lines Changed')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.tokens ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          tokens: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Tokens')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.cache ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          cache: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Cache')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.apiTime ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          apiTime: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('API Time')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.currentDir ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          currentDir: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Current Dir')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.projectDir ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          projectDir: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Project Dir')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={claudeCodeIntegration.statusLineFields?.version ?? false}
                    onChange={(e) =>
                      setClaudeCodeIntegration({
                        statusLineFields: {
                          ...claudeCodeIntegration.statusLineFields,
                          version: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {t('Version')}
                </label>
              </div>
            </div>
          )}

          {/* Claude Provider */}
          <div className="mt-4 border-t pt-4">
            <div className="mb-3">
              <span className="text-sm font-medium">{t('Claude Provider')}</span>
              <p className="text-xs text-muted-foreground">
                {t('Manage Claude API provider configurations')}
              </p>
            </div>
            <ProviderList />
          </div>

          {/* MCP Servers */}
          <McpSection />

          {/* Plugins */}
          <PluginsSection />

          {/* Prompts */}
          <PromptsSection />
        </div>
      )}

      {/* AI API Section */}
      <div className="border-t pt-6">
        <div>
          <h4 className="text-base font-medium">{t('AI API')}</h4>
          <p className="text-sm text-muted-foreground">
            {t('Configure AI API providers for AI features')}
          </p>
        </div>

        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('Protocol')}</span>
            <div className="space-y-1.5">
              <Select
                value={thirdPartyAiConfig.protocol}
                onValueChange={(value) =>
                  setThirdPartyAiConfig({ protocol: value as AiApiProtocol })
                }
              >
                <SelectTrigger className="w-52">
                  <SelectValue>
                    {API_PROTOCOLS.find((p) => p.value === thirdPartyAiConfig.protocol)?.label ??
                      'OpenAI Compatible'}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {API_PROTOCOLS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <p className="text-xs text-muted-foreground">{t('HTTP API protocol')}</p>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('Base URL')}</span>
            <div className="space-y-1.5">
              <Input
                value={thirdPartyAiConfig.baseUrl}
                onChange={(e) => setThirdPartyAiConfig({ baseUrl: e.target.value })}
                placeholder={getApiBaseUrlPlaceholder(thirdPartyAiConfig.protocol)}
                className="max-w-xl"
              />
              <p className="text-xs text-muted-foreground">
                {t('API endpoint base URL, including /v1 when required')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('API Key')}</span>
            <div className="space-y-1.5">
              <Input
                type="password"
                value={thirdPartyAiConfig.apiKey}
                onChange={(e) => setThirdPartyAiConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="max-w-xl"
              />
              <p className="text-xs text-muted-foreground">
                {t('Used when any feature runs in API mode')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('Default Model')}</span>
            <div className="space-y-1.5">
              <ModelCombobox
                value={thirdPartyAiConfig.model}
                onChange={(value) => setThirdPartyAiConfig({ model: value })}
                className="w-52"
              />
              <p className="text-xs text-muted-foreground">
                {t('Used when a feature does not override the API model')}
              </p>
            </div>
          </div>

          {/* Test Connection */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('Test Connection')}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                disabled={
                  testingConnection ||
                  !thirdPartyAiConfig.baseUrl ||
                  !thirdPartyAiConfig.apiKey ||
                  !thirdPartyAiConfig.model
                }
                onClick={async () => {
                  setTestingConnection(true);
                  setTestResult(null);
                  try {
                    const result = await window.electronAPI.ai.testConnection(thirdPartyAiConfig);
                    setTestResult(result);
                  } catch (err) {
                    setTestResult({
                      success: false,
                      error: err instanceof Error ? err.message : 'Unknown error',
                    });
                  } finally {
                    setTestingConnection(false);
                  }
                }}
              >
                {testingConnection ? t('Testing...') : t('Test Connection')}
              </button>
              {testResult && (
                <span
                  className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-500'}`}
                >
                  {testResult.success
                    ? `${t('Connected')} (${testResult.latency}ms)`
                    : testResult.error}
                </span>
              )}
              {!testResult && !testingConnection && (
                <span className="text-xs text-muted-foreground">
                  {!thirdPartyAiConfig.baseUrl ||
                  !thirdPartyAiConfig.apiKey ||
                  !thirdPartyAiConfig.model
                    ? t('Not configured')
                    : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Commit Message Generator Section */}
      <div className="mt-6 border-t pt-6">
        <div>
          <h3 className="text-lg font-medium">{t('Commit Message Generator')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Auto-generate commit messages using AI')}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{t('Enable Generator')}</span>
            <p className="text-xs text-muted-foreground">
              {t('Generate commit messages with AI assistance')}
            </p>
          </div>
          <Switch
            checked={commitMessageGenerator.enabled}
            onCheckedChange={(checked) => setCommitMessageGenerator({ enabled: checked })}
          />
        </div>

        {commitMessageGenerator.enabled && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Provider Mode */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Mode')}</span>
              <div className="space-y-1.5">
                <Select
                  value={commitMessageGenerator.providerMode}
                  onValueChange={(v) =>
                    setCommitMessageGenerator({ providerMode: v as AiProviderMode })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {PROVIDER_MODES.find((m) => m.value === commitMessageGenerator.providerMode)
                        ?.label ?? 'CLI'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {PROVIDER_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('Choose between local CLI providers and configured HTTP APIs')}
                </p>
              </div>
            </div>

            {commitMessageGenerator.providerMode === 'api' && (
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <span className="text-sm font-medium">{t('API Model')}</span>
                <div className="space-y-1.5">
                  <ModelCombobox
                    value={commitMessageGenerator.apiModel}
                    onChange={(value) => setCommitMessageGenerator({ apiModel: value })}
                    showDefault
                    className="w-52"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('Leave empty to use the global default model')}
                  </p>
                </div>
              </div>
            )}

            {/* Max Diff Lines */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Max Diff Lines')}</span>
              <div className="space-y-1.5">
                <Input
                  type="number"
                  value={commitMessageGenerator.maxDiffLines}
                  onChange={(e) =>
                    setCommitMessageGenerator({ maxDiffLines: Number(e.target.value) || 1000 })
                  }
                  min={100}
                  max={10000}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  {t('Maximum number of diff lines to include')}
                </p>
              </div>
            </div>

            {/* Timeout */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Timeout')}</span>
              <div className="space-y-1.5">
                <Select
                  value={String(commitMessageGenerator.timeout)}
                  onValueChange={(v) => setCommitMessageGenerator({ timeout: Number(v) })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue>{commitMessageGenerator.timeout}s</SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {[30, 60, 120, 180].map((sec) => (
                      <SelectItem key={sec} value={String(sec)}>
                        {sec}s
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">{t('Timeout in seconds')}</p>
              </div>
            </div>

            {/* Model - only show in CLI mode */}
            {commitMessageGenerator.providerMode === 'cli' && (
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <span className="text-sm font-medium">{t('Model')}</span>
                <div className="space-y-1.5">
                  <Select
                    value={commitMessageGenerator.model ?? 'haiku'}
                    onValueChange={(v) =>
                      setCommitMessageGenerator({
                        model: v as 'default' | 'opus' | 'sonnet' | 'haiku',
                      })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue>
                        {(commitMessageGenerator.model ?? 'haiku') === 'default'
                          ? t('Default')
                          : (commitMessageGenerator.model ?? 'haiku').charAt(0).toUpperCase() +
                            (commitMessageGenerator.model ?? 'haiku').slice(1)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="haiku">Haiku</SelectItem>
                      <SelectItem value="sonnet">Sonnet</SelectItem>
                      <SelectItem value="opus">Opus</SelectItem>
                      <SelectItem value="default">{t('Default')}</SelectItem>
                    </SelectPopup>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('Claude model for generating commit messages')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Review Section */}
      <div className="mt-6 border-t pt-6">
        <div>
          <h3 className="text-lg font-medium">{t('Code Review')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('AI-powered code review for staged changes')}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{t('Enable Code Review')}</span>
            <p className="text-xs text-muted-foreground">
              {t('Show code review button in source control')}
            </p>
          </div>
          <Switch
            checked={codeReview.enabled}
            onCheckedChange={(checked) => setCodeReview({ enabled: checked })}
          />
        </div>

        {codeReview.enabled && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Provider Mode */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Mode')}</span>
              <div className="space-y-1.5">
                <Select
                  value={codeReview.providerMode}
                  onValueChange={(v) => setCodeReview({ providerMode: v as AiProviderMode })}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {PROVIDER_MODES.find((m) => m.value === codeReview.providerMode)?.label ??
                        'CLI'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {PROVIDER_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('Choose between local CLI providers and configured HTTP APIs')}
                </p>
              </div>
            </div>

            {codeReview.providerMode === 'api' && (
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <span className="text-sm font-medium">{t('API Model')}</span>
                <div className="space-y-1.5">
                  <ModelCombobox
                    value={codeReview.apiModel}
                    onChange={(value) => setCodeReview({ apiModel: value })}
                    showDefault
                    className="w-52"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('Leave empty to use the global default model')}
                  </p>
                </div>
              </div>
            )}

            {/* Model - only show in CLI mode */}
            {codeReview.providerMode === 'cli' && (
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <span className="text-sm font-medium">{t('Model')}</span>
                <div className="space-y-1.5">
                  <Select
                    value={codeReview.model}
                    onValueChange={(v) =>
                      setCodeReview({ model: v as 'opus' | 'sonnet' | 'haiku' })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue>
                        {codeReview.model.charAt(0).toUpperCase() + codeReview.model.slice(1)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="haiku">Haiku</SelectItem>
                      <SelectItem value="sonnet">Sonnet</SelectItem>
                      <SelectItem value="opus">Opus</SelectItem>
                    </SelectPopup>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('Claude model for code review')}
                  </p>
                </div>
              </div>
            )}

            {/* Language */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Language')}</span>
              <div className="space-y-1.5">
                <Input
                  value={codeReview.language ?? '中文'}
                  onChange={(e) => setCodeReview({ language: e.target.value })}
                  placeholder="中文"
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  {t('Language for code review output')}
                </p>
              </div>
            </div>

            {/* Continue Conversation */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">{t('Continue Conversation')}</span>
                <p className="text-xs text-muted-foreground">
                  {t('Preserve session for follow-up conversations after review')}
                </p>
              </div>
              <Switch
                checked={codeReview.continueConversation ?? true}
                onCheckedChange={(checked) => setCodeReview({ continueConversation: checked })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 border-t pt-6">
        <div>
          <h3 className="text-lg font-medium">{t('Branch Name Generator')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Auto-generate branch names using Claude')}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{t('Enable Generator')}</span>
            <p className="text-xs text-muted-foreground">
              {t('Generate branch names with AI assistance')}
            </p>
          </div>
          <Switch
            checked={branchNameGenerator.enabled}
            onCheckedChange={(checked) => setBranchNameGenerator({ enabled: checked })}
          />
        </div>

        {branchNameGenerator.enabled && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Provider Mode */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Mode')}</span>
              <div className="space-y-1.5">
                <Select
                  value={branchNameGenerator.providerMode}
                  onValueChange={(v) =>
                    setBranchNameGenerator({ providerMode: v as AiProviderMode })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {PROVIDER_MODES.find((m) => m.value === branchNameGenerator.providerMode)
                        ?.label ?? 'CLI'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {PROVIDER_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('Choose between local CLI providers and configured HTTP APIs')}
                </p>
              </div>
            </div>

            {branchNameGenerator.providerMode === 'api' && (
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <span className="text-sm font-medium">{t('API Model')}</span>
                <div className="space-y-1.5">
                  <ModelCombobox
                    value={branchNameGenerator.apiModel}
                    onChange={(value) => setBranchNameGenerator({ apiModel: value })}
                    showDefault
                    className="w-52"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('Leave empty to use the global default model')}
                  </p>
                </div>
              </div>
            )}

            {/* Model - only show in CLI mode */}
            {branchNameGenerator.providerMode === 'cli' && (
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <span className="text-sm font-medium">{t('Model')}</span>
                <div className="space-y-1.5">
                  <Select
                    value={branchNameGenerator.model ?? 'haiku'}
                    onValueChange={(v) =>
                      setBranchNameGenerator({
                        model: v as 'default' | 'opus' | 'sonnet' | 'haiku',
                      })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue>
                        {(branchNameGenerator.model ?? 'haiku') === 'default'
                          ? t('Default')
                          : (branchNameGenerator.model ?? 'haiku').charAt(0).toUpperCase() +
                            (branchNameGenerator.model ?? 'haiku').slice(1)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="haiku">Haiku</SelectItem>
                      <SelectItem value="sonnet">Sonnet</SelectItem>
                      <SelectItem value="opus">Opus</SelectItem>
                      <SelectItem value="default">{t('Default')}</SelectItem>
                    </SelectPopup>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('Claude model for generating branch names')}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t('Prompt')}</span>
              <div className="space-y-1.5">
                <textarea
                  value={branchNameGenerator.prompt}
                  onChange={(e) => setBranchNameGenerator({ prompt: e.target.value })}
                  className="w-full h-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={t(
                    'Enter a prompt template, and the AI will generate branch names according to your rules.\nAvailable variables:\n• {description} - Feature description\n• {current_date} - Current date\n• {current_time} - Current time'
                  )}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t('Customize the AI prompt for generating branch names')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            'This will restore the default AI prompt for generating branch names. Your custom prompt will be lost.'
                          )
                        )
                      ) {
                        setBranchNameGenerator({
                          prompt: defaultBranchNameGeneratorSettings.prompt,
                        });
                      }
                    }}
                    className="text-xs text-muted-foreground hover:text-primary underline"
                  >
                    {t('Restore default prompt')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
