// 미리 만든 동물 캐릭터 (프로필 사진 대신). 자유롭게 바꿀 수 있다.
export const AVATARS = [
  { id: "fox", emoji: "🦊", name: "여우" },
  { id: "rabbit", emoji: "🐰", name: "토끼" },
  { id: "bear", emoji: "🐻", name: "곰" },
  { id: "cat", emoji: "🐱", name: "고양이" },
  { id: "dog", emoji: "🐶", name: "강아지" },
  { id: "panda", emoji: "🐼", name: "판다" },
  { id: "koala", emoji: "🐨", name: "코알라" },
  { id: "lion", emoji: "🦁", name: "사자" },
  { id: "tiger", emoji: "🐯", name: "호랑이" },
  { id: "penguin", emoji: "🐧", name: "펭귄" },
  { id: "owl", emoji: "🦉", name: "부엉이" },
  { id: "hamster", emoji: "🐹", name: "햄스터" },
];

export const isAvatar = (id: unknown) => typeof id === "string" && AVATARS.some((a) => a.id === id);
