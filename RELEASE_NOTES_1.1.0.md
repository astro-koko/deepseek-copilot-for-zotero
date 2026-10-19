# Release Notes - Version 1.1.0

## 🚀 Major Updates

### Model & Thinking Configuration
- **Unified Model**: All conversations now use `deepseek-flash` model
- **Thinking Control**: New settings to control reasoning depth
  - Toggle thinking on/off
  - Choose reasoning effort: Low (faster, lower cost) or Max (deeper reasoning, higher cost)
- **Automatic Migration**: Existing `deepseek-v4-pro` configurations automatically migrate to `deepseek-flash` with max reasoning effort

### Web Search Powered by DeepSeek Search
- **Native Integration**: Now uses DeepSeek's official Search API (`/v1/tools/search`)
- **Simplified Setup**: No separate API key needed - uses your existing DeepSeek API key
- **Better Results**: Direct integration with DeepSeek's search infrastructure
- **Removed**: Tavily and OpenAlex search providers (no longer needed)

### Streamlined Settings Interface
- **Removed Model Selector**: Simplified to single model with configurable thinking
- **New Thinking Settings Section**: Clear controls for reasoning depth
- **Cleaner Layout**: Removed external search service configuration
- **Updated Help Text**: Clearer guidance in both English and Chinese

## 🔧 Technical Changes

### API Changes
- New `thinkingEnabled` boolean setting (default: `true`)
- New `reasoningEffort` setting: `"low"` | `"max"` (default: `"low"`)
- Removed `evidenceProviderMode` setting
- Removed `tavilyApiKey` setting
- Search API: `/v1/tools/search` with automatic authentication

### Breaking Changes
- **Search Providers**: Tavily and OpenAlex integrations removed
- **Settings**: `evidenceProviderMode` and `tavilyApiKey` no longer used
- **Model Names**: `deepseek-v4-pro` and `deepseek-v4-flash` deprecated (auto-migrated)

### Migration Guide
Existing configurations will automatically migrate:
- `deepseek-v4-flash` → `deepseek-flash` (reasoning effort: low)
- `deepseek-v4-pro` → `deepseek-flash` (reasoning effort: max)
- External search settings will be ignored (DeepSeek Search used automatically)

## 📊 Test Coverage
- ✅ 329 tests passing
- ✅ Full migration compatibility tested
- ✅ All UI components validated

## 🌐 Localization
- Updated English (en-US) and Chinese (zh-CN) translations
- New thinking-related UI strings
- Simplified web search descriptions

## 🐛 Bug Fixes
- Fixed context compression handling
- Improved error messages for search failures
- Better handling of long conversations

## 📝 Notes
- DeepSeek API key is now used for both chat and search
- Thinking can be toggled per conversation or globally in settings
- Max reasoning effort increases token usage but provides deeper analysis

---

**Full Changelog**: https://github.com/your-repo/deepseek-copliot/compare/v1.0.1...v1.1.0
