// T-036/D30 固定头像集：12 款官方图案，文件名即 ID，与后端 main.AVATAR_IDS 白名单一一对应。
// 不开放自定义上传；展示位最大 76px，256px 源覆盖 3x DPR；素材为 256px WebP（cwebp q85）。
import fox from "../assets/avatars/fox.webp";
import hokkaidoBrownBear from "../assets/avatars/hokkaido-brown-bear.webp";
import japaneseMacaque from "../assets/avatars/japanese-macaque.webp";
import koi from "../assets/avatars/koi.webp";
import manekiNeko from "../assets/avatars/maneki-neko.webp";
import owl from "../assets/avatars/owl.webp";
import rabbit from "../assets/avatars/rabbit.webp";
import redCrownedCrane from "../assets/avatars/red-crowned-crane.webp";
import shibaInu from "../assets/avatars/shiba-inu.webp";
import shimaEnaga from "../assets/avatars/shima-enaga.webp";
import sikaDeer from "../assets/avatars/sika-deer.webp";
import tanuki from "../assets/avatars/tanuki.webp";

export interface AvatarOption {
  id: string;
  label: string;
  url: string;
}

// 展示顺序：因素材清单固定，label 用于选择器的无障碍名称
export const AVATARS: AvatarOption[] = [
  { id: "shiba-inu", label: "柴犬", url: shibaInu },
  { id: "fox", label: "狐狸", url: fox },
  { id: "tanuki", label: "狸猫", url: tanuki },
  { id: "rabbit", label: "兔子", url: rabbit },
  { id: "maneki-neko", label: "招财猫", url: manekiNeko },
  { id: "japanese-macaque", label: "日本猕猴", url: japaneseMacaque },
  { id: "hokkaido-brown-bear", label: "棕熊", url: hokkaidoBrownBear },
  { id: "sika-deer", label: "梅花鹿", url: sikaDeer },
  { id: "red-crowned-crane", label: "丹顶鹤", url: redCrownedCrane },
  { id: "owl", label: "猫头鹰", url: owl },
  { id: "shima-enaga", label: "银喉长尾山雀", url: shimaEnaga },
  { id: "koi", label: "锦鲤", url: koi },
];

/** 头像 ID → 打包后的图片 URL；非法/未设置返回 null（回退首字印章）。 */
export function avatarUrl(id?: string | null): string | null {
  if (!id) return null;
  return AVATARS.find((option) => option.id === id)?.url ?? null;
}
