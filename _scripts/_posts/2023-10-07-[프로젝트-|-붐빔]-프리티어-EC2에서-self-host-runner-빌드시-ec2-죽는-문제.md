---
layout: post
date: 2023-10-07
title: "[프로젝트 | 붐빔] 프리티어 EC2에서 self-host runner 빌드시 ec2 죽는 문제"
tags: [AWS, github-action, boobim, issue, ]
categories: [프로젝트, 붐빔, ]
---


> 📌 인스턴스는 ec2 프리티어에서 제공하는 `t2.micro`에서 동작한다.   
> - `t2.micro`은 1코어와 1GB 램을 제공한다.

	- `t2.micro`은 1코어와 1GB 램을 제공한다.


### 문제 상황 및 해결 과정 요약

1. self-hosted runner를 사용해서 배포시 CPU가 99%를 찍고 인스턴스가 죽는 것을 확인
2. 배포 시점에 CPU 사용량 확인
	1. 기존 node가 실행된 상태로 빌드 수행시 CPU를 과도하게 사용하는 것을 확인
3. github 워크플로우 순서 변경
	1. 기존 node를 죽이고 빌드 수행

이슈를 해결한 PR 확인 

- [**chore: ec2 사양(t2.micro) 이슈로 deploy 순서 변경 #8**](https://github.com/2023vworks/boombim-be/pull/8)


### 1. 이슈 관측


배포 워크플로우 실행시 서버가 죽는 것을 확인

- EC2 지표를 확인

	![0](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/0.png)



### 2. 문제 상황 추측 및 확인 


self-host-runner를 사용해서 EC2 인스턴스에서 빌드를 수행하고 있는다. 이때 CPU를 과도하게 사용하는 상황으로 추측 한다.


**문제 상황에서 배포 워크플로우**

1. 빌드
2. **기존 node를 kill**
3. 빌드된 신규 앱 실행

즉, node가 켜진 상태에서 빌드가 발생하도록 하였다. (앱이 꺼진 시간을 최소화를 위해)



#### 2.1. 빌드시 cpu 사용량 확인


![1](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/1.png)


![2](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/2.png)



#### 2.2. 배포가 수행중이지 않을때 메모리 사용량 확인하기


ec2 프리티어에서 제공하는 `t2.micro` 는 1기가 램을 제공한다.

1. `free` 명령으로 램 확인

	![3](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/3.png)


	출력 설명

	1. `total`: 시스템에 총 설치된 물리적 메모리의 양을 나타냅니다. 여기서는 약 949 MB 입니다.
	2. `used`: 현재 사용 중인 메모리의 양입니다. 여기서는 약 354 MB입니다.
	3. `free`: 아무런 데이터나 캐시되지 않은 남은 사용 가능한 메모리의 양입니다. 
	여기서는 약 70 MB입니다.
	4. `shared`: 여러 프로세스가 공유하는 메모리의 양입니다. 여기서는 거의 사용되지 않아 0입니다.
	5. `buff/cache`: 버퍼와 캐시된 메모리의 양입니다. 
	이 메모리는 파일 I/O 작업을 최적화하기 위해 사용됩니다. 여기서는 약 524 MB입니다.
	6. `available`: 새로운 프로세스가 시작될 때 사용 가능한 메모리의 양입니다. 버퍼/캐시와 함께 고려한 값입니다. 여기서는 약 398 MB입니다.
	7. `Swap`: 스왑 영역의 상태를 보여줍니다. 여기서는 스왑이 사용되지 않았음을 나타내는 0 바이트입니다.
1. `ps -fu ubuntu` 로 실행중인 프로세스 확인

	![4](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/4.png)

- action runner 관련 프로세스


{% raw %}
```typescript
PID
1865  /bin/bash ./run.sh
1869  /bin/bash /home/ubuntu/actions-runner/run-helper.sh
1873  /home/ubuntu/actions/runner/bin/Runner.Listener run
```
{% endraw %}


- 실행중인 node 앱


{% raw %}
```typescript
PID
2107  node dist/src/main.js
```
{% endraw %}


1. `ps -p 1865,1869,1873,2107 -o %mem,%cpu,cmd` 로 프로세스가 사용중인 리소스 확인

	![5](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/5.png)

1. 한번에 확인하는 방법

	→ `ps -u ubuntu -o %p --no-header | xargs -I {} ps -p {} -o %mem,%cpu,cmd`


	![6](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/6.png)



### 3. 해결 방법

1. 빌드시 일시적으로 디스트 스왑 기능을 켜서 메모리를 증축한다.

	⇒ 성능상 손해를 많이 보지 않을까?  본래 앱에도 영향을 주지 않을까?

2. 배포 워크플로우를 수정한다.
	- 기존: 빌드 수행 → 기존 node kill → 빌드된 신규 node 실행
	- 변경: node kill → 빌드 → 빌드된 신규 node 실행
3. 인스턴스의 사양을 올린다.

**사이드 프로젝트이기 때문에 가장 현실적인 방법인 워크플로 순서를 변경해서 문제를 해결했다.**

1. **기존 node를 kill**
2. 빌드
3. 빌드된 신규 앱 실행


#### 추가 amazon-cloudwatch-agent 설치시 꽤 많은 램을 먹는다.


![7](/assets/img/2023-10-07-프로젝트--붐빔-프리티어-EC2에서-self-host-runner-빌드시-ec2-죽는-문제.md/7.png)



### 참고 

- [**AWS EC2 프리티어 쓰시는분들 참고하세요!**](https://docs.aws.amazon.com/ko_kr/redshift/latest/dg/ST_MakeEnvelope-function.html)
undefined