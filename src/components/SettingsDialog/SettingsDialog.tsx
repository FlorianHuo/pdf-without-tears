import { useState, useEffect } from "react";
import { loadAiConfig, saveAiConfig } from "../../utils/aiTocGenerator";
import styles from "./SettingsDialog.module.css";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.siliconflow.cn/v1");
  const [model, setModel] = useState("Qwen/Qwen2.5-VL-72B-Instruct");
  const [showKey, setShowKey] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    if (open) {
      const saved = loadAiConfig();
      if (saved.apiKey) setApiKey(saved.apiKey);
      if (saved.baseUrl) setBaseUrl(saved.baseUrl);
      if (saved.model) setModel(saved.model);
    }
  }, [open]);

  const handleSave = () => {
    saveAiConfig({ apiKey, baseUrl, model });
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>AI Settings</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>API Key</label>
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                spellCheck={false}
              />
              <button
                className={styles.toggleBtn}
                onClick={() => setShowKey(!showKey)}
                type="button"
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>API Base URL</label>
            <input
              className={styles.input}
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.siliconflow.cn/v1"
              spellCheck={false}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Model</label>
            <input
              className={styles.input}
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Qwen/Qwen2.5-VL-72B-Instruct"
              spellCheck={false}
            />
            <span className={styles.hint}>
              Recommended: Qwen/Qwen2.5-VL-72B-Instruct
            </span>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!apiKey.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
