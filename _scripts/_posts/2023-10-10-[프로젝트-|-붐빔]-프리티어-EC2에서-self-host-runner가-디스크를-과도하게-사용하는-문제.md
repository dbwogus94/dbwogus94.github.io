---
layout: post
date: 2023-10-10
title: "[프로젝트 | 붐빔] 프리티어 EC2에서 self-host runner가 디스크를 과도하게 사용하는 문제"
tags: [AWS, github-action, boobim, ]
categories: [프로젝트, 붐빔, ]
mermaid: true
---



### 1. 실행 환경


AWS에서 프리티어로 제공하는 `EC2`를 사용하고 있다. (1코어, RAM 1GB)


실행중인 프로그램

- github self-host-runner
- nestjs API 서버


### 2. 문제 확인: ec2 쉘로 접근하여 메모리 확인

- `df -h`

	![0](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/0.png)

- `du -h --max-depth=1 ~ | sort -rh`

	![1](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/1.png)


	⇒ aws 프리티어에서 제공하는 ec2는 8GB 디스크를 제공한다.
	⇒ 사용중인 용량이 갑자기 늘어 확인해보니 `actions-runner`가 용량을 많이 먹고 있는 것을 볼 수 있다.



### 3. 해결: 여러가지 이유가 있는데 일딴 극단적인 방법으로 디스크 여유 공간을 늘렸다



#### 3.1. `_work/_update/externals`  & `_work/__externals__` 제거

- **워크플로우에서 사용할 default node 버전이 있는 위치이다.**
- 기본 설치되어 있는 버전: `node 16`, `node 16-alpine`, `node 20`, `node 20-alpine`
- 개발환경과 동일한 `v18.14.2` 버전을 사용하기 때문에 기본 설치 버전은 필요가 없다.


{% raw %}
```javascript
- name: Use Node.js v18.14.2
  uses: actions/setup-node@v3
  with:
    node-version: v18.14.2
```
{% endraw %}


- `Use Node.js v18.14.2`에서 셋팅된 node 버전을 다운로드 수행하는 로그 스크린샷

	![2](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/2.png)

- `Use Node.js v18.14.2` 캐시된 node 버전을 사용하는 로그 스크린샷

	![3](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/3.png)


**[제거 후 용량 확인]**

- `df -h`

	![4](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/4.png)


	⇒ 12% 여유공간 획득 

- `du -h --max-depth=1 ~ | sort -rh`

	![5](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/5.png)


	⇒ 900MB 감소



#### 3.2. `workspace`(working directory) 제거



{% raw %}
```yaml
- name: Remove github.workspace
  run: |
    cd ..
    cp -r ${{ github.workspace }}/.github/workflows/deploy.yaml ./deploy.yaml
    rm -rf ${{ github.workspace }} || true
    mkdir -p ${{ github.workspace }}/.github/workflows
    cp ./deploy.yaml ${{ github.workspace }}/.github/workflows/deploy.yaml
```
{% endraw %}


- 주의점: `${{ github.workspace }}/.github/workflows/deploy.yaml` 파일이 없으면 문제 발생.

	![6](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/6.png)

	- `Post Cache node_module` 에러 로그

	
{% raw %}
```yaml
	Error: The template is not valid. 
	.github/workflows/deploy.yaml (Line: 83, Col: 16): 
	An error occurred trying to start process 
	'/home/ubuntu/actions-runner/externals/node16/bin/node' 
	with working directory 
	'/home/ubuntu/actions-runner/_work/heat-it-be/heat-it-be'. 
	No such file or directory
```
{% endraw %}


	- `Post Checkout actions Repository` 에러 로그

	
{% raw %}
```yaml
	Post job cleanup.
	Error: An error occurred trying to start process 
	'/home/ubuntu/actions-runner/externals/node16/bin/node' with working directory 
	'/home/ubuntu/actions-runner/_work/heat-it-be/heat-it-be'. No such file or directory
```
{% endraw %}



	문제 1)  `deploy.yaml` 없음

	- working directory를 제거하면서 `.github/workflows/deploy.yaml`가 유실됨

	문제 2) `default node` 없음

	- `deploy.yaml`가 없기 때문에 정의된 node 버전을 찾지 못하게 되며, `default node`을 찾는다.
	- 하지만 위에서 설명 했듯 `/home/ubuntu/actions-runner/externals`를 제거 했기 때문에 `default node`는 존재하지 않는다.

**[제거 후 용량 확인]**

- `df -h`

	![7](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/7.png)


	⇒ 4% 여유공간 획득 

- `du -h --max-depth=1 ~ | sort -rh`

	![8](/assets/img/2023-10-10-프로젝트--붐빔-프리티어-EC2에서-self-host-runner가-디스크를-과도하게-사용하는-문제.md/8.png)


	⇒ 400MB 감소



### 결론

- action-runner의 용량을 2.9GB ⇒ 1.6GB
- 여유 공간 699MB ⇒ 2GB로 증가
- 사용률 91% ⇒ 75%로 감소

극단적인 방법을 사용하긴 했지만 결과적으로 사용량은 낮추고 정상적인 실행을 가능하게 하였다.
⇒ 8GB의 한계는 어쩔 수 없다보다.



### 참고

- 관련 이슈: [**Self-hosted runner cleanup/update bloat growing over time #2708**](https://github.com/actions/runner/issues/2708)
- [“](https://devopsjournal.io/blog/2023/06/21/GitHub-container-based-Action-cleanup)[**컨테이너에서 실행되는 GitHub Action으로 변경된 파일 정리” 관련 글**](https://devopsjournal.io/blog/2023/06/21/GitHub-container-based-Action-cleanup)
