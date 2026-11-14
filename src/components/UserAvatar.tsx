import { avatarUrl } from "../lib/avatars";

// T-036：头像统一渲染——设置了 avatar 显示图案，否则回退显示名首字印章（存量账号零变化）。
// 用于顶栏 avatar-button 与用户页 profile-avatar 两处；样式由外层类名控制。
export default function UserAvatar({ user }: { user: { avatar?: string | null; display_name?: string | null } | null }) {
  const url = avatarUrl(user?.avatar);
  if (url) return <img src={url} alt="" draggable={false} />;
  return <span>{user?.display_name?.slice(0, 1) || "D"}</span>;
}
