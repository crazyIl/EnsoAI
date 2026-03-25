import * as React from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from '@/components/ui/combobox';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';

interface ModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** 显示"默认（使用全局配置）"选项 */
  showDefault?: boolean;
  className?: string;
}

/**
 * 模型下拉搜索框
 * 支持从 /v1/models 获取模型列表 + 手动输入自定义模型
 */
export function ModelCombobox({ value, onChange, showDefault, className }: ModelComboboxProps) {
  const { t } = useI18n();
  const { thirdPartyAiConfig } = useSettingsStore();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [models, setModels] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fetched, setFetched] = React.useState(false);
  const [search, setSearch] = React.useState(value || '');
  const [isOpen, setIsOpen] = React.useState(false);

  const canFetch = Boolean(thirdPartyAiConfig.baseUrl && thirdPartyAiConfig.apiKey);

  const fetchModels = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.ai.fetchModels({
        protocol: thirdPartyAiConfig.protocol,
        baseUrl: thirdPartyAiConfig.baseUrl,
        apiKey: thirdPartyAiConfig.apiKey,
      });
      if (result.success && result.models) {
        setModels(result.models);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [thirdPartyAiConfig.apiKey, thirdPartyAiConfig.baseUrl, thirdPartyAiConfig.protocol]);

  // 打开下拉时自动获取模型（仅首次）
  React.useEffect(() => {
    if (isOpen && !fetched && canFetch) {
      fetchModels();
    }
  }, [isOpen, fetched, canFetch, fetchModels]);

  // config 变化时重置 fetched 状态
  const configKey = `${thirdPartyAiConfig.protocol}:${thirdPartyAiConfig.baseUrl}:${thirdPartyAiConfig.apiKey}`;
  const prevConfigKey = React.useRef(configKey);
  React.useEffect(() => {
    if (prevConfigKey.current !== configKey) {
      prevConfigKey.current = configKey;
      setFetched(false);
      setModels([]);
    }
  }, [configKey]);

  React.useEffect(() => {
    setSearch(value || '');
  }, [value]);

  // 过滤模型列表
  const searchLower = search.toLowerCase();
  const filteredModels = models.filter((m) => m.toLowerCase().includes(searchLower));

  // 如果输入了搜索词但不在列表中，显示"使用自定义"选项
  const showCustomOption =
    search.trim() && !models.includes(search.trim()) && !filteredModels.includes(search.trim());

  const commitSearchValue = React.useCallback(() => {
    const nextValue = search.trim();
    if (nextValue === value) {
      return;
    }
    onChange(nextValue);
    setSearch(nextValue);
  }, [onChange, search, value]);

  const handleValueChange = (newValue: string | null) => {
    if (newValue !== null) {
      onChange(newValue);
      setSearch(newValue);
    }
  };

  return (
    <div className={cn('w-52 max-w-full', className)}>
      <Combobox<string>
        value={value || null}
        onValueChange={handleValueChange}
        inputValue={search}
        onInputValueChange={setSearch}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <ComboboxInput
          ref={inputRef}
          placeholder={t('Search or enter model name...')}
          size="sm"
          onBlur={() => {
            window.requestAnimationFrame(() => {
              if (document.activeElement !== inputRef.current) {
                commitSearchValue();
              }
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitSearchValue();
              setIsOpen(false);
            }
          }}
        />
        <ComboboxPopup>
          <ComboboxList>
            {showDefault && (
              <ComboboxItem value="">
                <span
                  className="truncate text-muted-foreground"
                  title={t('Default (use global config)')}
                >
                  {t('Default (use global config)')}
                </span>
              </ComboboxItem>
            )}
            {loading && (
              <div className="py-3 text-center text-xs text-muted-foreground">
                {t('Fetching...')}
              </div>
            )}
            {!loading && fetched && filteredModels.length === 0 && !showCustomOption && (
              <div className="py-3 text-center text-xs text-muted-foreground">
                {t('No models found')}
              </div>
            )}
            {showCustomOption && (
              <ComboboxItem value={search.trim()}>
                <span className="truncate" title={search.trim()}>
                  {search.trim()}
                </span>
              </ComboboxItem>
            )}
            {filteredModels.map((m) => (
              <ComboboxItem key={m} value={m}>
                <span className="truncate" title={m}>
                  {m}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  );
}
