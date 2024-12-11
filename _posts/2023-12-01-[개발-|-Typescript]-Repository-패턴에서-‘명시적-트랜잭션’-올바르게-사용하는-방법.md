---
layout: post
date: 2023-12-01
title: "[개발 | Typescript] Repository 패턴에서 ‘명시적 트랜잭션’ 올바르게 사용하는 방법"
tags: [TS, Typeorm, 트랜잭션, ]
categories: [백엔드, TS, ]
mermaid: true
---


> 📌 **Custom Repository 패턴 구현방법과 ‘명시적 트랜잭션’을 사용하는 방법**을 다룹니다.


![0](/assets/img/2023-12-01-개발--Typescript-Repository-패턴에서-‘명시적-트랜잭션’-올바르게-사용하는-방법.md/0.png)



###  1. Nestjs는 선언적 트랜잭션을 지원하지 않는다.


예전 Nestjs 버전에서는 ‘선언적 트랜잭션’을 위한 `@Transactional` 데코레이터를 제공했었습니다.
하지만 안전하지 않다는 이유로 `@Transactional` **데코레이터는 deprecated 되었습니다.**


선언적 트랜잭션을 사용하지 않으면 결국’ 명시적 트랜잭션’을 사용해야 합니다.
그리고 Custom Repository 패턴에서 ‘명시적 트랜잭션’을 유연하게 사용하려면 고려할 점이 존재합니다.



###  2. 잘못된 Custom Repository 패턴 사용


Custom Repository를 만들어 사용하는 것은 유용합니다.


ORM 자체를 격리된 환경에서 사용할 수 있으며, Service 계층에서 DataBase를 의존하는 코드를 효과적으로 분리할 수 있으니까요. 


하지만 선언적 트랜잭션이 지원되지 않는다면 Custom Repository를 사용하는 것은 꽤나 불편해 집니다.


왜 불편한지 코드로 예시를 들어보겠습니다.

- UserEntity와 FeedEntity는 1 : N 관계입니다.
- `DELETE /api/users/:id` API가 호출되면 User는 제거됩니다.
- 그리고 User를 삭제하는 로직에서 유저가 가진 Feed도 모두 제거합니다.
- 즉, Delete User, Delete Feeds는 하나의 트랜잭션으로 처리해야 합니다.

**[Custom Repository 정의하기]**

- 트랜잭션을 위해 모든 메서드 인자로 EntityManager를 Optional로 받아야 합니다.

`UserRepository#softDeleteByPk`



{% raw %}
```typescript
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
		repository: Repository<UserEntity>
  ) {}
  
  async softDelete(
	 userId: number, 
	 **manager?: EntityManager, // 커낵션**
 ): Promise<void> {
	  if(manager) { 
		  // manager가 존재하면 manager를 사용한다.
		  await manager.softDelete(UserEntity, user.id); // 기존의 커넥션
	  } else {
		  await this.repository.softDelete(user.id); // 새로운 커넥션
	  }
  }
}
```
{% endraw %}



`FeedRepository#softDeleteByUserId`



{% raw %}
```typescript
@Injectable()
export class FeedRepository {
	constructor(
    @InjectRepository(FeedEntity)
    repository: Repository<FeedEntity>
  ) { }

 async softDeleteByUserId(
	 userId: number, 
	 **manager?: EntityManager,**
 ): Promise<void> {
		// manager가 존재하면 manager에서 QueryBuilder를 생성한다.
		const qb = manager
			? manager.createQueryBuilder(FeedEntity, 'feed')
			: this.repository.createQueryBuilder();

    await qb
      .where('feed."userId" = :userId', { userId })
      .softDelete()
      .execute();
  }
}
```
{% endraw %}



**[UserService 트랜잭션에서 Custom Repository 사용하기]**



{% raw %}
```javascript
export class UserService  {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly userRepo: UserRepository,
    private readonly feedRepo: FeedRepository,
  ) { }
  
  /** Delete User, Delete Feeds는 하나의 트랜잭션을 사용한다. */
  async softRemoveUser(userId: number): Promise<void> {
    const user = await this.userRepo.findOneByPK(userId);
    if (!user) throw new NotFoundException(errorMessage.E404_APP_001);
		
	  await this.dataSource.transaction(async (txManager) => {
			// 유저와 유저가 가진 피드 리스트 제거
	    **await this.userRepo.softDelete(user.id, txManager); 
	    await this.feedRepo.softDeleteByUserId(user.id, txManager);**
	  });
  }
}
```
{% endraw %}


- 명시적 트랜잭션을 사용할때는 보통 Service 계층에서 트랜잭션을 커낵션을 연결합니다.
- 그리고 위의 코드 처럼 트랜잭션이 시작된 connection을 가진 manager를 각각의 Custom Repository에 
인자로 전달해야 합니다.
- 이때 만약 개발자의 실수로 `manager`를 전달하지 않으면 어떻게 될까요?


{% raw %}
```typescript
// case 1
await this.userRepo.softDelete(user.id);
await this.feedRepo.softDeleteByUserId(user.id);

// case 2
await this.userRepo.softDelete(user.id, manager);
await this.feedRepo.softDeleteByUserId(user.id);

// case 3
await this.userRepo.softDelete(user.id);
await this.feedRepo.softDeleteByUserId(user.id, manager);
```
{% endraw %}



⇒ 모두 다른 커넥션을 사용하기 때문에 트랜잭션은 깨지게 됩니다.

undefined
위의 예시처럼 선언적 트랜잭션을 단순히 사용하기에는 불편한 점이 많습니다.

1. Custom Repository 매서드 마다, manager를 받을 수 있도록 셋팅해야한다.
2. 트랜잭션 로직에서 Custom Repository에 manager를 주입하지 않으면 트랜잭션이 정상 작동 할 수 없다.

그리고 이러한 불편함 때문에 `@Transactional` 지원 중단 시점에 많은 튜토리얼 코드에서 
Custom Repository 를 사용하는 방법을 소개하지 않게 됩니다.



###  3.  올바른 Custom Repository 패턴 사용하기



#### 3.1. 공식문서에 답이 있다.


typeorm 공식문서에서는 Custom Repository를 Class 방식이 아닌 typeorm에서 제공하는 Repository 인스턴스를 직접 확장하는 `Repository.extend` 매서드를 제공합니다.


공식문서에 나온 예제 코드입니다.


[bookmark](https://typeorm.io/custom-repository#how-to-create-custom-repository)



{% raw %}
```typescript
// user.repository.ts
export const UserRepository = dataSource.getRepository(User).extend({
    findByName(firstName: string, lastName: string) {
        return this.createQueryBuilder("user")
            .where("user.firstName = :firstName", { firstName })
            .andWhere("user.lastName = :lastName", { lastName })
            .getMany()
    },
})

// user.controller.ts
export class UserController {
    users() {
        return UserRepository.findByName("Timber", "Saw")
    }
}
```
{% endraw %}


- 이 방법으로 Custom Repository를 class 방식으로 사용하기에는 한계가 있었습니다.

그래도 혹시 모르니 Tyeporm의 [`Repository.extend()`](https://github.com/typeorm/typeorm/blob/master/src/repository/Repository.ts#L697) 구현 코드를 확인 해보겠습니다.



{% raw %}
```typescript
/**
 * Extends repository with provided functions.
 */
extend<CustomRepository>(
    customs: CustomRepository & ThisType<this & CustomRepository>,
): this & CustomRepository {
    // return {
    //     ...this,
    //     ...custom
    // };
    const thisRepo: any = this.constructor
    const { target, manager, queryRunner } = this
    const ChildClass = class extends thisRepo {
        constructor(
            target: EntityTarget<Entity>,
            manager: EntityManager,
            queryRunner?: QueryRunner,
        ) {
            super(target, manager, queryRunner)
        }
    }
    for (const custom in customs)
        ChildClass.prototype[custom] = customs[custom]
    return new ChildClass(target, manager, queryRunner) as any
}
```
{% endraw %}


- 위의 코드는 단순합니다.
	1. 현재 인스턴스(Repository)의 생성자를 가져온다
	⇒ `const thisRepo: any = this.constructor`
	2. 현재 인스턴스의 커넥션 정보를 가져온다
	⇒  `const { target, manager, queryRunner } = this`
	3. 현재 인스턴스를 상속하는 자식 클래스를 만든다.
	⇒ `const ChildClass = class extends thisRepo { … }`
	4. 생성된 자식클래스에 전달 받은 확장된 기능들을 추가한다.
	⇒ `for (const custom in customs)`
	        `ChildClass.prototype[custom] = customs[custom]`
	5. 자식클래스를 사용하여 인스턴스를 생성한다. 이때 현재 인스턴스의 커넥션 정보를 넣는다.
	⇒ `return new ChildClass(target,` **`manager`**`, queryRunner) as any`
- 즉, 인자로 받은 **기능을 추가한 새로운 Repository 인스턴스를 만들어 리턴** 합니다.
	- 이때 커넥션 정보를 생성된 인스턴스에 전달하여 **동일한 커넥션을 사용**하게 합니다.


#### 3.2. Custom Repository class를 위한 `BaseRepository` 선언


`Repository.extend()`를 기능을 class 방식으로 수행하는 BaseRepository를 정의했습니다.



{% raw %}
```typescript
import { EntityManager, EntityTarget, Repository } from 'typeorm';

export class BaseRepository<Entity> extends Repository<Entity> {
  constructor(
    readonly targetEntity: EntityTarget<Entity>,
    readonly manager: EntityManager,
  ) {
    super(targetEntity, manager, manager.queryRunner);
  }

  /**
   * queryRunner.manager를 주입받아 트랜잭션에 사용할 새로운 Repository 생성 리턴한다.
   * @param manager - queryRunner.manager
   */
  createTransactionRepo(manager: EntityManager): this {
    const constructor = this.constructor;
    if (!manager.queryRunner) {
      throw new Error('EntityManager does not have queryRunner.');
    }
    if (constructor.name === 'BaseRepository') {
      throw new Error('Instance is not BaseRepository child.');
    }
    return new (constructor as any)(manager);
  }
}
```
{% endraw %}


- BaseRepository는 typeorm의 Repository<Entity>를 상속합니다.
- `createTransactionRepo`를 정의합니다.
- `createTransactionRepo(manager)` 인자로 manager를 받아서 현재 인스턴스를 다시 생성합니다.

이제 위의 예시를 동일하게 가져와서 BaseRepository를 상속하는 Custom Repository를 정의해 보겠습니다.

- UserEntity와 FeedEntity는 1 : N 관계입니다.
- `DELETE /api/users/:id` API가 호출되면 User는 제거됩니다.
- 그리고 User를 삭제하는 로직에서 유저가 가진 Feed도 모두 제거합니다.
- 즉, Delete User, Delete Feeds는 하나의 트랜잭션에 묶입니다.

**[Custom Repository 정의하기]**


`UserRepository` - BaseRepository<UserEntity>를 상속합니다.



{% raw %}
```typescript
@Injectable()
export class UserRepository extends BaseRepository<UserEntity> {
  constructor(
    @InjectEntityManager()
    readonly manager: EntityManager,
  ) {
    super(UserEntity, manager);
  }
  // softDelete를 선언할 필요가 없습니다.
}
```
{% endraw %}



`FeedRepository` - BaseRepository<FeedEntity>를 상속합니다.



{% raw %}
```typescript
@Injectable()
export class FeedRepository extends BaseRepository<FeedEntity> {
  constructor(
    @InjectEntityManager()
    readonly manager: EntityManager,
  ) {
    super(FeedEntity, manager);
  }
  
	async softDeleteByUserId(userId: number): Promise<void> {
    await this.createQueryBuilder()
      .where('feed."userId" = :userId', { userId })
      .softDelete()
      .execute();
  }
}
```
{% endraw %}



**[UserService 트랜잭션에서 Custom Repository 사용하기]**

- 트랜잭션 로직에 사용 예시


{% raw %}
```typescript
export class UserService  {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly userRepo: UserRepository,
    private readonly feedRepo: FeedRepository,
  ) { }
  
  /** Delete User, Delete Feeds는 하나의 트랜잭션을 사용한다. */
	async softRemoveUser(userId: number): Promise<void> {
    const user = await this.userRepo.findOneByPK(userId);
    if (!user) throw new NotFoundException(errorMessage.E404_APP_001);

    await this.dataSource.transaction(async (txManager) => {
 		  // 같은 트랜잭션을 사용하는 Custom Repository를 생성한다.
      **const txUserRepo = this.userRepo.createTransactionRepo(txManager);
      const txFeedRepo = this.feedRepo.createTransactionRepo(txManager);**

			// 이제 모두 같은 커낵션에서 트랜잭션이 된다.
      await txUserRepo.softDelete(user.id);
      await txFeedRepo.softDeleteByUserId(user.id);
    });
  }
}
```
{% endraw %}


- BaseRepository를 상속한 모든 Custom Repostory는 createTransactionRepo를 사용할 수 있습니다.
- 그리고 createTransactionRepo에 의해 같은 트랜잭션을 사용할 수 있기 때문에 매서드마다 인자로 manager을 전달할 필요가 없습니다.
- 또한 `UserRepository`의 경우 BaseRepository의 부모인 typeorm의 Repository를 상속한 것과 같습니다. `UserRepository`에 `softDelete` 매서드를 선언하지 않아도 사용이 가능합니다.
	- 즉, `UserRepository` 인스턴스에서 `softDelete()`를 호출하면, **Prototype Chaining에 의해**  tyeporm Repository의 `softDelete`가 호출됩니다.


###  4. 정리


![1](/assets/img/2023-12-01-개발--Typescript-Repository-패턴에서-‘명시적-트랜잭션’-올바르게-사용하는-방법.md/1.png)


Nestjs에서 ‘선언적 트랜잭션’을 다시 제공하면 좋겠지만 아직까지 그런 움직임은 없어 보입니다.


때문에 Nestjs를 사용하는 다양한 조직에서는 Nestjs의 core 코드에 접근하여, 
선언적 트랜잭션을 구현하는 움직임도 있습니다.


또한 Typeorm 이외에 최근에 나오는 ORM들은 콜백 방식의 트랜잭션만 제공하기도 합니다.


앞으로 어떻게 바뀔지 어떤게 정답일지는 알 수 없지만 저는 공식 문서와 가장 근접하게 구현한 `BaseRepository` 방식이 적합하다고 판단하였습니다.

