---
layout: post
date: 2025-07-31
title: "[issue | pnpm] pnpm 환경에서 sqlilte3 바이너리 파일 빌드 못하는 오류 해결 가이드"
tags: [pnpm, nodejs, ]
categories: [issue, pnpm, ]
mermaid: true
---



### 1. 문제 상황


**환경**

- MacOS 15.x (arm64)
- Node.js v20.15.0
- pnpm 10.7.0
- `@mikro-orm/sqlite` → sqlite3@5.1.7 사용

**발생 에러**



{% raw %}
```bash
Error: Could not locate the bindings file
→ /node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3/lib/binding/node-v115-darwin-arm64/node_sqlite3.node
```
{% endraw %}




### 2. 원인 추측


🧐 **LLM에게 질문한 답변을 통한 상황 추측**


perplexity, cursor, claude에게 해결방법을 질문하는 경우 주로 3가지 방향을 제시합니다.

- 프리빌트 바이너리가 Apple Silicon(arm64)용으로 제공되지 않거나, 잘못된 아키텍처의 바이너리가 설치됨
- Node.js와 sqlite3, OS, npm, 패키지 캐시 등 각종 환경 변수 불일치
- 정리되지 않은 node_modules나 lock 파일, 빌드 캐시 문제

하지만 사용중인 개발환경에서 sqlite3 라이브러리로 프로젝트를 진행한 경험이 있었기 때문에 위 3가지 모두 문제라고 생각되지는 않았습니다. 그럼에도 가능성은 열어두고 모두 점검은 해보았습니다.
결과적으로 문제는 없었고, 변경된 것은 npm이 pnpm으로 변경된 상황 뿐이였습니다.


**가설**: pnpm이 post-install 스크립트를 실행하지 않아서 네이티브 바이너리가 빌드되지 않았을 것


**근거**

- sqlite3 설치 시 `prebuild-install -r napi || node-gyp rebuild` 명령이 실행되어야 함

	👉🏻 참고: 명령어 의미


		`prebuild-install -r napi`명령으로 OS와 Node.js 버전에 맞는 사전 빌드된(prebuilt) 네이티브 바이너리(.node 파일)를 내려받기를 시도합니다. 찾지 못했다면 `node-gyp rebuild` 명령으로 C++로 작성된 sqlite3 소스코드를 현재 OS와 CPU 아키텍처에 맞게 컴파일 수행합니다.

- pnpm은 보안상 post-install 스크립트를 기본적으로 차단함
- 네이티브 바이너리(`node_sqlite3.node`) 파일이 생성되지 않음


### 3. 가설을 확인하기 위한 간단한 테스트

1. 동일한 npm 프로젝트를 셋팅하고, `sqlite3@5.1.7`를 package.json에 추가합니다.
2. sqlite와 통신을 테스트 합니다.

방법 1) 스크립트로 테스트



{% raw %}
```typescript
// 테스트 코드
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('test.db');
db.get('SELECT 1 as test', [], (err, row) => {
  console.log(row);
});
```
{% endraw %}



방법 2) 터미널로 단순 테스트



{% raw %}
```bash
node -e "console.log(require('sqlite3'))"
```
{% endraw %}


1. 테스트 결과
	- `npm install` → 정상 실행 ✅
	- `pnpm install` → 바이너리 파일 없음 에러 ❌
		- `Could not locate the bindings file`
2. 빌드된 바이너리 파일 확인


{% raw %}
```bash
ls node_modules/sqlite3/build/Release/node_sqlite3.node
```
{% endraw %}




#### 📌 문제 원인 확인


**sqlite3의 ARM64 호환성이 아닌, pnpm의 빌드 스크립트 미실행**을 확인



### 4. 해결 방법


⚠️ 효과 없었던 방법

1. `export npm_config_build_from_source=true` 환경변수 주입으로 post-install 실행
2. `.npmrc`파일에 `enable-pre-post-scripts=true` 값을 추가하는 방법으로 post-install 실행


#### 4.1. `sqlite3@5.1.7`을 의존성에 추가합니다.


**'pnpm의 엄격한 의존성 격리'**라는 설계 철학을 가지고 있어 간접 의존성(`@mikro-orm/sqlite`이 의존하는 `sqlite3`)에 직접 접근하기 어렵습니다.


**pnpm 구조의 특징**

- `node_modules/sqlite3`는 symlink로 `.pnpm` 스토어를 가리킴
- 직접적인 경로 접근이 제한됨
- 이로 인해 `cd node_modules/sqlite3` 명령이 복잡해짐

**해결책**: sqlite3를 직접 의존성으로 추가



{% raw %}
```json
{
  "dependencies": {
    "@mikro-orm/sqlite": "^6.4.11",
    "sqlite3": "5.1.7"
  }
}
```
{% endraw %}




#### 4.2. `node_modules/sqlite3` 접근해서 바이너리 빌드를 수행합니다.



{% raw %}
```bash
pnpm install
cd node_modules/sqlite3
## prebuild-install -r napi || node-gyp rebuild 실행됩니다.
npm run install
cd ../../
```
{% endraw %}




#### 자동화 방법



{% raw %}
```json
{
  "scripts": {
    "postinstall": "cd node_modules/sqlite3 && npm run install && cd ../../"
  }
}
```
{% endraw %}


- `postinstall` 명령을 통해 pnpm install이 완료되면 sqlite3 바이너리 빌드가 수행되게 설정합니다.
