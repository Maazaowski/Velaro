import { usePlaygroundStore } from '../../stores/playgroundStore';
import { Zap } from 'lucide-react';
import './Playground.css';

const presets = [
  { key: 'creative' as const, label: 'Creative', desc: 'High variety' },
  { key: 'balanced' as const, label: 'Balanced', desc: 'Default' },
  { key: 'precise' as const, label: 'Precise', desc: 'Focused' },
];

export default function GenerationSettings() {
  const { settings, updateSettings, applyPreset } = usePlaygroundStore();

  return (
    <div className="settings-panel">
      {/* Presets */}
      <div className="settings-section">
        <div className="settings-section-title">Presets</div>
        <div className="preset-row">
          {presets.map((p) => (
            <button key={p.key} className="preset-btn" onClick={() => applyPreset(p.key)}>
              <Zap size={12} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="settings-section">
        <div className="settings-section-title">Parameters</div>

        <SettingSlider
          label="Temperature"
          value={settings.temperature}
          min={0} max={2} step={0.05}
          hint="Randomness. Higher = more creative."
          onChange={(v) => updateSettings({ temperature: v })}
        />
        <SettingSlider
          label="Top-P"
          value={settings.topP}
          min={0.1} max={1} step={0.05}
          hint="Nucleus sampling cutoff."
          onChange={(v) => updateSettings({ topP: v })}
        />
        <SettingSlider
          label="Top-K"
          value={settings.topK}
          min={1} max={100} step={1}
          hint="Limit vocabulary per step."
          onChange={(v) => updateSettings({ topK: v })}
        />
        <SettingSlider
          label="Max Tokens"
          value={settings.maxNewTokens}
          min={16} max={1024} step={16}
          hint="Maximum tokens to generate."
          onChange={(v) => updateSettings({ maxNewTokens: v })}
        />
        <SettingSlider
          label="Repetition Penalty"
          value={settings.repetitionPenalty}
          min={1} max={2} step={0.05}
          hint="Penalize repeated tokens."
          onChange={(v) => updateSettings({ repetitionPenalty: v })}
        />
      </div>
    </div>
  );
}

function SettingSlider({
  label, value, min, max, step, hint, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  hint: string; onChange: (v: number) => void;
}) {
  return (
    <div className="setting-row">
      <div className="setting-header">
        <span className="setting-label">{label}</span>
        <span className="setting-value">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="setting-slider"
      />
      <div className="setting-hint">{hint}</div>
    </div>
  );
}
