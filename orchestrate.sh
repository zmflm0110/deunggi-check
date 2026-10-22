#!/usr/bin/env bash
# '등기체크' — 갈래마다 git worktree 하나 + 백그라운드 Claude 세션 하나를 띄운다.
# 세션 수만큼 내 Claude 구독 사용량을 동시에 쓴다. 팀이면 각자 자기 갈래만 손으로 열어도 된다:
#   claude -w <갈래> -n <갈래>   (그리고 .claude/tasks/<갈래>.md 내용을 붙여 넣기)
set -euo pipefail
cd "$(dirname "$0")"
command -v claude >/dev/null || { echo "Claude Code 가 없어요 — https://claude.com/claude-code"; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { git init -q; }
git add -A && git commit -qm "킥오프: VYNE 키트" 2>/dev/null || true
PERM="${PERM:-acceptEdits}"   # 고치기는 자동 허용, 명령 실행은 물어봄. 더 맡기려면 PERM=auto
echo "갈래 4개(app, data, core, demo)를 백그라운드 Claude 세션으로 띄웁니다 — 구독 사용량을 4배로 씁니다."
read -r -p "계속할까요? [y/N] " ok; [ "${ok:-n}" = "y" ] || { echo "그만둠"; exit 0; }
claude --bg -n app -w app --permission-mode "$PERM" "$(cat .claude/tasks/app.md)"
claude --bg -n data -w data --permission-mode "$PERM" "$(cat .claude/tasks/data.md)"
claude --bg -n core -w core --permission-mode "$PERM" "$(cat .claude/tasks/core.md)"
claude --bg -n demo -w demo --permission-mode "$PERM" "$(cat .claude/tasks/demo.md)"
echo
echo "진행 보기: claude agents · 들어가 보기: claude attach <갈래> · 기록: claude logs <갈래> · 멈추기: claude stop <갈래>"
echo "합치기: 각 worktree 의 갈래 브랜치를 차례로 main 에 merge — 폴더가 나뉘어 있어 부딪힘이 적다."
