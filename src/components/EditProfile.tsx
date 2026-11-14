import { useState } from "react";
import AvatarPicker from "./AvatarPicker";
import { AVATARS } from "../lib/avatars";
import { api } from "../lib/study";
import { useAuthStore } from "../stores/auth";
import { FieldInput, ModalOverlay } from "./CommonUi";

// T-036/D30 编辑资料：当前头像预览 + 「更换头像」（二级弹窗选择）+ 昵称，一次 PATCH 同存。
// 头像选择只在弹窗内改本地状态，最终由「保存」统一提交；失败留在弹层内提示。
export default function EditProfile({ onClose }: { onClose: () => void }) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setUser = useAuthStore((state) => state.setUser);
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  const [name, setName] = useState(currentUser?.display_name ?? "");
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const trimmed = name.trim();
  const previewUrl = AVATARS.find((option) => option.id === avatar)?.url ?? null;

  async function save() {
    if (!token || !currentUser || saving || !trimmed) return;
    setSaving(true);
    setFailed(null);
    try {
      const updated = await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar, display_name: trimmed }),
      }, token);
      setUser(updated);
      onClose();
    } catch {
      setFailed("保存失败，请检查网络后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay title="编辑资料" onClose={onClose}>
      <div className="edit-profile-avatar-row">
        <span className="edit-profile-preview">
          {previewUrl ? <img src={previewUrl} alt="" draggable={false} /> : <span className="avatar-pick-letter">{trimmed.slice(0, 1) || "D"}</span>}
        </span>
        <button className="profile-edit-button" onClick={() => setPicking(true)} type="button">更换头像</button>
      </div>
      <div className="edit-profile-form">
        <FieldInput label="昵称" value={name} onChange={setName} placeholder="1-128 个字符" maxLength={128} />
      </div>
      {failed ? <p className="form-error">{failed}</p> : null}
      <div className="edit-profile-actions">
        <button className="secondary-button" onClick={onClose} type="button">取消</button>
        <button className="primary-button" onClick={save} disabled={saving || !trimmed} type="button">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
      {picking ? (
        <AvatarPicker current={avatar} onPick={(id) => { setAvatar(id); setPicking(false); }} onClose={() => setPicking(false)} />
      ) : null}
    </ModalOverlay>
  );
}
