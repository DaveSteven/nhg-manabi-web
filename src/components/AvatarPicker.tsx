import { AVATARS } from "../lib/avatars";
import { useAuthStore } from "../stores/auth";
import { ModalOverlay } from "./CommonUi";

// T-036/D30 头像选择二级弹窗：由「编辑资料」弹层的「更换头像」呼出。
// 点选即回传（不直接保存，最终由编辑资料弹层的「保存」统一提交），点遮罩/Esc 取消。
export default function AvatarPicker({ current, onPick, onClose }: { current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const displayName = useAuthStore((state) => state.currentUser?.display_name);
  return (
    <ModalOverlay title="选择头像" onClose={onClose} stacked>
      <div className="avatar-picker-grid">
        <button
          className={current === null ? "avatar-pick is-current" : "avatar-pick"}
          onClick={() => onPick(null)}
          type="button"
          aria-label="默认头像（显示名首字）"
        >
          <span className="avatar-pick-letter">{displayName?.slice(0, 1) || "D"}</span>
        </button>
        {AVATARS.map((option) => (
          <button
            key={option.id}
            className={current === option.id ? "avatar-pick is-current" : "avatar-pick"}
            onClick={() => onPick(option.id)}
            type="button"
            aria-label={option.label}
          >
            <img src={option.url} alt="" draggable={false} />
          </button>
        ))}
      </div>
    </ModalOverlay>
  );
}
