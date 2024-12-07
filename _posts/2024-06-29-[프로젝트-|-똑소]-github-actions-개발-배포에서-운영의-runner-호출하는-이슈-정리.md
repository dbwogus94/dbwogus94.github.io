---
layout: post
date: 2024-06-29
title: "[프로젝트 | 똑소] github actions 개발 배포에서 운영의 runner 호출하는 이슈 정리"
tags: [github-action, issue, ]
categories: [시리즈, 프로젝트, ]
---


> 📌 24년 06월 29일에 발생한 이슈를 정리



### 1. 이슈 상황



#### 1.1. 문제상황


![0](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/0.png)

1. 운영서버 개발서버 모두 **운영 서버에 설치된 self-hosted runner를 호출하고 있는 문제 발행**한다.
2. 결과적으로 **개발, 운영 배포가 모두 운영 서버에 배포**되고 있다.


#### 1.2. 발생시기


현재 프로젝트는 태그를 사용해서 배포를 하고 있다. 

- 운영 태그 배포 트리거 패턴 - `v[0-9]+.[0-9]+.[0-9]+`
- 개발 태그 배포 트리거 패턴 - `v[0-9]+.[0-9]+.[0-9]+-beta.[0-9]+`

그리고 `v1.0.0-beta.0` 버전의 배포 시점 부터 문제가 발생하는 것을 찾을 수 있었다.


**정상 로그 -** **`v0.0.65-beta.0`** **배포 로그** 


![1](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/1.png)

- 배포로 트리거된 Self Hosted Runner name이 `ddocso-dev-server`인 것을 볼 수 있다.

**비정상 로그 -** **`v1.0.0-beta.0`** **배포 로그**


![2](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/2.png)

- 배포로 트리거된 Self Hosted Runner name이 `api-prod`인 것을 볼 수 있다.


### 2. 이슈 원인 확인



#### 2.1. 개발 운영 러너 설정 확인


1. github action의 workflow는 `runs-on`에 부여된 label을 실행할 머신을 결정한다.

	- `runs-on: ubuntu-22.04` : github에서 제공하는 가상 머신을 통해 job이 실행된다.
	- `runs-on: [self-hosted]`: 사용자의 머신에 설치된 **self-hosted runner(자체 호스트 러너)**를 호출하여 사용자의 머신에서 job이 실행된다.
1. 개발 운영 모두 자체 설치된 self-hosted runner를 호출하여 배포를 진행한다.
	- `runs-on: [<label>]`의 label은 배열이 가능하며, label의 조합을 통해 어떤 hosted runner를 호출할지 지정할 수 있다.

3. 운영 서버의 경우 추가적인 label을 부여했고, 개발서버의 경우 default(`self-hosted`, `Linux`, `X64`) 로 생성된 label만 사용했다. (label 지정은 self hosted runner 설치시 부여한다.)

- 운영 러너에 부여된 라벨: [`self-hosted`, `Linux`, `X64`, **`api-prod`**]
undefined

{% raw %}
```yaml
deploy:
  needs: build
  name: Deploy
runs-on: [self-hosted, api-prod]
```
{% endraw %}



![3](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/3.png)

- 개발 러너에 부여된 라벨: [`self-hosted`, `Linux`, `X64`]


{% raw %}
```yaml
deploy:
  needs: build
  name: Deploy
runs-on: [self-hosted]
```
{% endraw %}



![4](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/4.png)



#### 2.2. 문제 원인 추측했다.


지난주에 개발서버에 설치된 self hosted runner를 잠시 죽였다가 실행했다. 그리고 개발서버의 self hosted runner를 다시 시작할 때 github에 셋팅된 운영 배포 설정과 매핑된게 아닌가 의심된다.
이러한 추측을 하게된 이유는 아래 2가지 공식문서 설명 때문이다.

1. self hosted runner와 github 통신방법

	→ [github 공식문서 확인](https://docs.github.com/ko/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners#communication-between-self-hosted-runners-and-github)


	공식문서에 따르면 github은 self hosted runner가 통신이 가능한지 확인한다. 확인을 위해 **https를 사용하여 50초의 long polling**을 한다. 


	그리고 long polling에 응답이 성공하면, 해당 self hosted runner와 연결된다.

2. label을 통해 통신할 self hosted runner 선정

	→ [github 공식문서 확인](https://docs.github.com/ko/actions/writing-workflows/choosing-where-your-workflow-runs/choosing-the-runner-for-a-job#overview)


	> If you specify an array of strings or variables, your workflow will execute on any runner that matches all of the specified runs-on values. For example, here the job will only run on a self-hosted runner that has the labels linux, x64, and gpu:


위의 1과 2를 통해 상황을 추측하면 아래와 같다.

1. 개발 러너가 `Kill`이 되었다.
2. github는 주기적으로 `self-hosted` label을 가진 runner에게 요청(https long polling)을 보낸다.
3. 이 시점에 `self-hosted` label을 가진 서버는 **운영 서버 뿐이다**
	- 개발: `runs-on: [self-hosted]`
	- 운영: `runs-on: [self-hosted, api-prod]`
4. github가 **개발 러너에게 보낸 요청을 운영 서버에 설치된 runner가 응답하게 된다.**
5. 결과적으로 운영에 설치된 runner는 개발과 운영의 workflow를 모두 처리하게 된다.


#### 2.3. 추가적인 근거


self host runner는 workflow를 실행할때 log 파일을 생성한다. ([공식문서 참고](https://docs.github.com/ko/actions/hosting-your-own-runners/managing-self-hosted-runners/monitoring-and-troubleshooting-self-hosted-runners#reviewing-the-self-hosted-runner-application-log-files))

- 개발 서버에서 쉘로 들어가서 self host runner가 생성한 로그 파일 리스트 확인

	![5](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/5.png)


	⇒ 이슈가 생긴 후로 배포 로그 파일이 생성되지 않는 것을 확인할 수 있었다.



### 3. 문제해결


![6](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/6.png)


결과적으로 문제 해결은 간단하다.


개발 운영 공통 label이 아니라 개발 러너 전용으로 신규 라벨을 부여하면 된다.([공식문서 부여 방법 참고](https://docs.github.com/ko/actions/hosting-your-own-runners/managing-self-hosted-runners/using-labels-with-self-hosted-runners))

- 운영 `runs-on: [self-hosted, api-prod]`
- 개발: `runs-on: [self-hosted, api-dev]`


#### 3.1. 배포 정상 동작 확인


**운영 배포**


![7](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/7.png)

- `Runner name: 'api-prod'` 확인

**개발 배포**


![8](/assets/img/2024-06-29-프로젝트--똑소-github-actions-개발-배포에서-운영의-runner-호출하는-이슈-정리.md/8.png)

- `Runner name: 'ddocso-dev-server'` 확인 (러너 이름은 라벨 이름이 아니다.)
