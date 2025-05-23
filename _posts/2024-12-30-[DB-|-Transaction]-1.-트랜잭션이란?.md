---
layout: post
date: 2024-12-30
title: "[DB | Transaction] 1. 트랜잭션이란?"
tags: [DB, 트랜잭션, ]
categories: [시리즈, DB, ]
mermaid: true
---



### 1. 트랜잭션이란?


트랜잭션은 데이터베이스 관리 시스템(DBMS)에서 사용되는 개념으로, 데이터베이스에 수행되는 작업의 기본 단위이다. 여기서 말하는 작업의 기본 단위란 데이터의 일관성을 보장하기 위한 최소한의 단위이다.



#### 은행 송금 작업으로 예시


많이 사용되는 예제인 은행 송금 작업으로 예시를 들어보자.


> 은행 송금이라는 작업은 간단하게 2가지 단계로 이루어진다.  
> 1. A계좌에서 10,000원을 출금한다.  
> 2. B계좌에 10,000원을 입금한다.


이때 1번 작업이 실행되고, 2번 작업은 실패하면 어떻게 될까?
**A계좌는 10,000원이 출금되고, B계좌에는 입금되지 않는 현상이 발생한다.**


은행 시스템에서 이러한 문제는 시스템에 **치명적인 결함**을 의미한다. 그리고 이 같은 상황을 방지하기 위해 여러 작업을 묶어서 최소한의 작업 단위로 관리하게 되며, 이를 **트랜잭션(Transaction)**이라 한다. 


예제의 1번, 2번 작업은 **항상 함께 성공하거나** **함께 실패해야 하는** 논리적으로 묶인 **최소한의 작업 수행 단위**이다.또한 트랜잭션 기능은 주로 데이터 저장 시스템인 DBMS에서 지원한다. 



### 2. 트랜잭션이 필요한 다양한 이유


현실의 데이터베이스 시스템은 다양한 이유로 문제가 생길 수 있다.

- 데이터베이스(DBMS)나 하드웨어는(쓰기 연산이 실행 중일 때를 포함해서) 언제라도 실패할 수 있다.
- 네트워크가 문제로 애플리케이션과 데이터베이스의 연결이 끊기거나 DB 노드 사이의 통신이 안 될 수 있다.
- 애플리케이션은 언제라도 죽을 수 있다.
- 여러 클라이언트가 동시에 데이터베이스 쓰기를 실행해서 다른 클라이언트가 쓴 내용을 덮어 쓸 수 있다.
- 클라이언트가 부분적으로만 갱신돼서 비정상적인 데이터를 읽을 수 있다.
- 클라이언트 사이의 경쟁 조건은 예측하지 못한 버그를 유발할 수 있다.

위와 같은 다양한 이유로 **DBMS는 신뢰성과 내결함성을 지키기 위해 트랜잭션을 지원**한다.



### 3. 트랜잭션 조금 더 이해하기


시스템이 신뢰성을 지니려면 다양한 결함(장애) 상황이 전체 시스템으로 이어지는 것을 막아야 한다.


이러한 내결함성을 갖춘 시스템은 해야할 일이 아주 많은데, 지난 수십년 동안 트랜잭션은 이러 문제를 단순화하는 메커니즘으로 채택되어 왔다.


트랜잭션은 애플리케이션에서 몇 개의 읽기와 쓰기 작업을 하나의 논리적 단위로 묶는 방법이다. 개념적으로 한 트랜잭션 내의 모든 읽기와 쓰기는 하나의 연산으로 실행된다. 즉, **트랜잭션은 전체가 성공(commit)하거나 실패(abort)한다.**



#### 트랜잭션을 사용하면 왜 신뢰성을 가질까?


DBMS 같은 프로그램에서 **트랜잭션이 실패**했다는 의미는 **트랜잭션이 실행되기 이전 상태로 돌아갔다는 의미**이며, **안전하게 재시도**를 할 수 있다는 것을 의미한다.


즉, 트랜잭션을 사용하면 **애플리케이션에서 오류 처리 과정이 단순해지는 것이다.**


하지만 모든 애플리케이션에서 트랜잭션이 필요한 것은 아니다. 때로는 트랜잭션 보장을 완화하거나 사용하지 않는 게 이득 일 수 있다.



### 4. 트랜잭션이 필요한지 어떻게 알 수 있을까?  


이러한 질문에 답을 하려면, 먼저 트랜잭션이 제공하는 안정성 보장에는 어떤 것이 있으며, 이과 관련된 비용은 무엇인지 정확히 이해해야 한다.



#### 4.1. 트랜잭션을 이해하기 위해 필요한 내용

- 트랜잭션이 보장하는 ACID에 의미를 알아야 한다.
	- A - 원자성(Atomicity)
	- C - 일관성(Consistency)
	- I - 격리성(Isolation)
	- D - 지속성(Durability)
- 트랜잭션에서 발생할 수 있는 다양한 문제와 트랜잭션 격리 레벨에 대한 이해가 있어야 한다.
	- 문제: `Dirty Read`, `Non-Repeatable Read`, `Phantom Read`
	- 격리레벨: `Read Committed`, `Snapshot Isolation`, `serializability`
- (심화)분산 환경에서 트랜잭션에 대한 이해가 있어야 한다.


### 5. 트랜잭션 꼭 사용해야 할까?


MSA, 분산 데이터베이스 같은 상황에서 트랜잭션은 필요하지 않다는 주장 또는 트랜잭션은 확장성을 보장하는데 걸림돌이라는 주장도 있다. 반대로 데이터베이스 벤더들은 트랜잭션적인 보장은 애플리케이션에 필수적인 요구사항이라고 주장한다. 


정답은 없다고 생각한다. 다른 기술적 설계 선택과 마찬가지로 트랜잭션 또한 이점과 한계가 있다.


즉, 트레이드 오프가 발생하는 것이다.


사용하고 안하고는 각각의 상황에 맞춰야 하겠지만 구글의 전역 분산 데이터베이스 팀은 이렇게 말했다고 한다.


> 어떤 저자들은 2단계 커밋에서 유발되는 성능이나 가용성 문제 때문에 생기는 비용이 너무 커서 이를 지원할 수 없다고 주장했다.   
> 우리는 항상 트랜잭션 없이 코딩하는 것보단 트랜잭션을 과용해서 병목지점이 생기는 성능 문제를 애플리케이션 프로그래머가 처리하는 게  낫다고 생각한다.  
> -- 제임스 고벳 외, 스패너: 구글의 전역 분산 데이터베이스(2012)



### 참고

- [데이터 중심 애플리케이션 설계](https://www.yes24.com/Product/Goods/59566585) 7장. 트랜잭션
