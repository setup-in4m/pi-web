import { useProfileStore } from "../../stores/profileStore";
import { usePanelStore } from "../../stores/panelStore";

interface Props {
  panelIndex: number;
}

export function ProfileSelector({ panelIndex }: Props) {
  const profiles = useProfileStore((s) => s.profiles);
  const setModel = usePanelStore((s) => s.setModel);
  const setThinking = usePanelStore((s) => s.setThinking);

  const handleSelect = (profileId: string) => {
    if (!profileId) return;
    const profile = useProfileStore.getState().getProfile(profileId);
    if (!profile) return;
    setModel(panelIndex, profile.provider, profile.modelId);
    setThinking(panelIndex, profile.thinking);
  };

  return (
    <select
      defaultValue=""
      onChange={(e) => handleSelect(e.target.value)}
      className="bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-1 py-0 text-[9px] font-sans cursor-pointer max-w-[90px] outline-none focus:border-[var(--color-accent)]"
      title="Agent profile"
    >
      <option value="">profile</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.icon || ""} {p.name}
        </option>
      ))}
    </select>
  );
}
