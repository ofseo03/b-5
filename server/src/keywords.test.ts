import { test } from "node:test";
import assert from "node:assert/strict";
import { extractNouns, isVague, needsFollowup, choiceKeywords } from "./keywords.js";
import { getQuestion } from "./questions.js";

test("조사를 떼고 명사만 남긴다", () => {
  assert.deepEqual(extractNouns("SF 영화를 극장에서 혼자 봐요"), ["SF", "영화", "극장"]);
  assert.deepEqual(extractNouns("고양이를 키우고 요가를 해요"), ["고양이", "요가"]);
});

test("명사+하다 활용에서 명사를 뽑고 동의어를 합친다", () => {
  assert.deepEqual(extractNouns("주말마다 산책하고 헬스장 가요"), ["산책", "운동"]);
  assert.deepEqual(extractNouns("영화관에서 콘서트 실황 봤어요"), ["극장", "공연", "실황"]);
});

test("용언 활용형은 버린다", () => {
  assert.deepEqual(extractNouns("좋아하는 영화 얘기, 요즘 빠진 것 공유하기"), ["영화", "공유"]);
  assert.deepEqual(extractNouns("저녁엔 혼자 보는 편"), []);
});

test("모호한 답을 알아본다", () => {
  assert.equal(isVague("그냥"), true);
  assert.equal(isVague("다 좋아요~"), true);
  assert.equal(isVague("보드게임 카페 가기"), false);
});

test("꼬리 질문 조건", () => {
  const q1 = getQuestion("q1")!;
  assert.equal(needsFollowup(q1, "영화", 0, 2), true, "10자 미만");
  assert.equal(needsFollowup(q1, "그냥 이것저것 다 좋아해요", 0, 2), true, "명사 없음");
  assert.equal(needsFollowup(q1, "SF 영화를 극장에서 혼자 봐요", 0, 2), false);
  assert.equal(needsFollowup(q1, "영화", 2, 2), false, "질문당 최대 2개");
  const q7 = getQuestion("q7")!;
  assert.equal(needsFollowup(q7, "야 주말에 뭐해? 시간 되면 보자 ㅋㅋ", 0, 2), false, "말투 질문은 길이만 본다");
  const q5 = getQuestion("q5")!;
  assert.equal(needsFollowup(q5, "", 0, 2), false, "자유 입력이 선택인 질문");
});

test("선택지 문구를 키워드로", () => {
  assert.deepEqual(choiceKeywords("영화·드라마"), ["영화", "드라마"]);
  assert.deepEqual(choiceKeywords("기타"), []);
});
