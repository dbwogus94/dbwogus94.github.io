---
layout: post
date: 2024-04-02
title: "[프로젝트 | 똑소] Type Safe 하지 못한 Typeorm, 도메인 객체로 해결해 보았다."
tags: [아키텍처, Typeorm, ]
categories: [프로젝트, 똑소, ]
mermaid: true
---


> 📌 Typeorm은 Node.js에서 많이 사용되는 ORM 라이브러리입니다. 그러나 Type Safe 측면에서 한계가 있어, 해당 포스팅은 이를 개선하기 위한 방법중 하나를 소개합니다.


**👀 결과 미리보기**


![0](/assets/img/2024-04-02-프로젝트--똑소-Type-Safe-하지-못한-Typeorm-도메인-객체로-해결해-보았다..md/0.png)



### Overview - ORM을 사용하는 이유


API서버, 웹서버, WAS서버 등등 다양한 서버가 있지만 서버는 기본적으로 클라이언트에 필요한 자원을 서빙합니다. 자원은 다양하게 해석될 수 있지만 해당 포스팅에서는 API 서버와 웹 클라이언트 관점에서 설명합니다.


저희 똑소 서비스는 유저에게 다양한 상품 UI를 제공합니다.


유저가 바라보는 상품 UI는 다양할 수 있지만, API 서버 입장에서는 **상품이라는 자원을 응답하는 것에 불과합니다.**


![1](/assets/img/2024-04-02-프로젝트--똑소-Type-Safe-하지-못한-Typeorm-도메인-객체로-해결해-보았다..md/1.png)_위 API에서는 모두 상품리스트에 필요한 “상품” 자원을 응답합니다._


그렇다면 API 서버는 상품이라는 자원을 UI에 보이는 그대로 보관하고 있을까요? 
UI에 필요한 데이터를 그대로 들고 있다면 정말 좋겠지만, 일반적으로는 데이터를 관리하기 편한 형태로 보관하고 있습니다. 데이터 보관을 잘하기 위해 많이 사용되는 도구는 RDBMS입니다.

- API 서버에서 제공하는 **상품은** 여러 테이블 데이터의 조합입니다.

![2](/assets/img/2024-04-02-프로젝트--똑소-Type-Safe-하지-못한-Typeorm-도메인-객체로-해결해-보았다..md/2.png)_product 관련 일부 ERD_



#### API 서버는 객체로 데이터를 관리합니다.


API 서버에서는 '상품' 하나를 표현하기 위해 여러 테이블의 데이터가 필요합니다. API 서버는 여러 테이블을 JOIN해서 하나의 '상품' 정보를 만듭니다.

- RDBMS의 `product`와 API 서버의 `Product` 객체

![3](/assets/img/2024-04-02-프로젝트--똑소-Type-Safe-하지-못한-Typeorm-도메인-객체로-해결해-보았다..md/3.png)


상품 API에서 상품을 응답하는 모든 로직에서는 아래와 같은 작업이 반복됩니다.

1. JOIN Query를 사용해서 DB에서 JOIN된 상품 데이터 받아오기
2. DB에서 받아온 데이터를 Product 객체에 매핑하기

이러한 반복 작업은 다양한 문제를 만들었고, 문제를 해결하기 위해 선배 개발자 분들은 ORM이라는 기술을 만들었습니다.


다양한 ORM이 존재하지만 ORM은 크게 두가지 역할을 제공한다고 생각합니다.

- SELETE Query를 추상화해 객체 입장에서 질의를 제공
- DB에서 응답된 데이터를 객체에 매핑

포스팅에서는 nodejs 런타임에서는 많이 사용하는 typeorm의 대표적인 단점인 type-safe 문제에 대한 한가지 대안을 소개합니다.



###  1. Typeorm은 type-safe를 보장하지 않는다.


우리는 Type Safety한 코드를 작성하기 위해 Typescript를 사용합니다.
하지만 Typescript 환경에서도 Typeorm을 사용하면, Type Safe 하지 못한 코드가 될 수 있습니다.


아래 `ProductEntity`가 있습니다.



{% raw %}
```typescript
@Entity('product')
export class ProductEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', comment: 'ID' })
  id: string;

  @Column('varchar', { comment: '상품명' })
  title: string;

  @Column('varchar', { comment: '이미지 URL', length: 1000 })
  imageUrl: string;

  @Column('tinyint', { comment: '재고유무', default: 1 })
  isStock: number;

  /* ============= 연관관계 ============= */
  @OneToMany(
    () => ProductCategoryEntity,
    (productCategory) => productCategory.product,
    { nullable: false },
  )
  productCategories: ProductCategoryEntity[];

  @OneToOne(() => ProductPriceEntity, (price) => price.product, {
    nullable: false,
    cascade: true,
  })
  price: ProductPriceEntity;
  
  @OneToMany(() => Notification, (noti) => noti.product, {
    nullable: true,
  })
  notifications?: Notification[];
}
```
{% endraw %}



위에 정의된 `ProductEntity`는 product 테이블을 추상화 합니다. 이를 ORM Entity라고 합니다. 


많은 경우 ORM Entity를 비즈니스 로직에 그대로 사용합니다. 그리고 ORM Entity를 비즈니스 로직에 사용한다는 의미는 ORM Entity가 도메인 규칙을 가지게 된다는 것을 의미합니다.


`ProductEntity` 도메인 규칙은?

1. 비즈니스적인 정책에 의거해 `ProductEntity`의 모든 필드에 **옵셔널이 아닌 값은 항상 존재합니다.**
	- 식별자(`id`), 상품명(`title`), 이미지 URL(`imageUrl`), 재고유무(`isStock`)은 모두 항상 존재
2. `nullable: false`인 연관관계는 항상 존재해야 합니다.
	- 상품의 가격 정보(`price`)는 항상 존재한다.
	- 상품은 하나 이상의 카테고리와 매핑(`productCategories`)된다.


#### 1.1. type-safe를 보장하지 못하는 상황 예시

1. 특정 필드만 `SELECT` - 상품의 특정 필드만 선택해서 조회


{% raw %}
```typescript
const productRepo = dataSource.getRepository(ProductEntity);
const product = await productRepo.findOne({
	select: { id: true, title: true }
	where: { id: '1' }
});

// Typescript 컴파일러는 아래의 값이 있다고 인식합니다.
product.imageUrl;
product.isStock;
```
{% endraw %}



특정 필드만 선택해 조회한 상황에서, 조회되지 않은 필드를 코드에서 사용하고 있습니다.


하지만 Typescript는 에러를 내보내지 않습니다. 이 **코드는 런타임이 되서야 에러를 발생시킵니다.**

1. JOIN 없이 `SELECT` - 연관관계 테이블 조회하지 않음


{% raw %}
```typescript
const productRepo = dataSource.getRepository(ProductEntity);
const product = await productRepo.findOneBy({ id: '1' });

// Typescript 컴파일러는 아래의 값이 있다고 인식합니다.
product.price;
product.productCategories;
```
{% endraw %}



연관관계 테이블을 JOIN 하지 않은 상황에서, 연관관계 필드를 코드에서 사용하고 있습니다.


하지만 Typescript는 에러를 내보내지 않습니다. **이 코드 또한 런타임이 되서야 에러를 발생시킵니다.**


예시의 경우는 아주 단순한 코드입니다. 그렇기 때문에 크게 위험하지 않아 보입니다. 
하지만 실제 비즈니스 코드는 단순하지 않기 때문에 복잡한 쿼리를 사용하는 경우 문제는 더 커질 수 있습니다.
게다가 계층형 아키텍처에 따라, ORM 로직을 비즈니스 로직에서 분리한 경우는 독이 되기도 합니다. 


결과적으로 Typeorm의 사용은 Type Safe 하지 못한 코드를 양산하기 쉽습니다. 이는 TypeScript의 장점을 충분히 활용하지 못하게 되고, 런타임 에러 위험을 증가시키고, 코드의 안정성을 낮추게 됩니다.



#### 1.2. 문제 발생 이유


문제는 크게 두 가지 관점에서 발생합니다

1. **TypeORM의 타입 추론 방식**
	- **Entity 클래스 하나로 모든 조회 결과의 타입을 정의**합니다.
	- 즉, **`select`**, **`relations`** 등 조회 조건에 따라 실제로는 다른 데이터가 반환되어도, TypeScript는 항상 Entity에 정의된 모든 필드가 존재한다고 판단합니다.
	- 다른 ORM들은 조회 조건에 따라 반환 타입이 자동으로 변경되는 반면, TypeORM은 그렇지 않습니다.
2. **TypeScript의 타입 시스템 한계**
	- TypeScript는 컴파일 타임에 타입을 체크합니다.
	- 하지만 TypeORM은 런타임에 실제 데이터를 조회하므로, 컴파일 타임의 타입 체크가 런타임의 실제 데이터 구조를 정확히 반영하지 못합니다.

결과적으로 TypeORM을 사용하면 TypeScript의 가장 큰 장점인 타입 안정성을 제대로 활용하지 못하게 됩니다.



##  2. 문제를 해결해 보자


Typeorm을 사용하지 않는다는 선택지도 있지만, 조금 다른 방법으로 문제를 풀어봤습니다.


**문제 정의**

- 결국 문제는 Entity의 필드는 Entity에 정의된 타입과 다르게 **`select`**, **`relations`** 등 조회 조건에 따라 동적으로 변경되어 런타임 에러를 유발한다는 것입니다.

**해결 방법**

- Typeorm의 Entity를 격리하고, 비즈니스 로직을 충실하게 수행 가능한 신뢰할 수 있는 Domain 객체를 선언해 사용하는 것입니다.


#### 2.1. Domain 객체를 정의하자


먼저 Type Safe하게 사용할 객체를 하나 정의해야 합니다.


3 계층 아키텍처를 기준으로 볼 때 영속화 계층에서 응답된 데이터는 주로 비즈니스 계층에서 사용됩니다. 때문에 Type Safe하게 사용할 객체는 Domain 객체가 적합하다고 생각했습니다.


> 💡 Domain 객체란 무엇일까요?


Domain 객체를 말하면 주로, DDD 관점의 도메인 객체가 떠올릴 수 있지만, DDD를 논하는 글이 아니기 때문에 단순하게 **“Domain 객체는 비즈니스 로직에 필요한 정보를 모두 가진 객체이다.”** 라고 정의해 봤습니다.

- `ProductDomain` 객체 예시


{% raw %}
```typescript
interface ProductProps {
  id: string;
  title: string;
  imageUrl: string;
  isStock: boolean;
  price: ProductPriceEntity;
  productCategories: ProductCategoryEntity[];
}

class Product {
  constructor(readonly props: ProductProps) {}

  get id(): string {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get imageUrl(): string {
    return this.props.imageUrl;
  }
	// ...생략 
	
  get **isAvailable**(): boolean {
    return this.props.isStock;
  }
  
  **hasCategory**(categoryId: string): boolean {
    return this.props.productCategories.some(category => category.id === categoryId);
  }
}
```
{% endraw %}


- `ProductProps` 에는 상품 비즈니스 로직에 필요한 모든 필드를 선언합니다.
	- `notifications`의 경우 상품 비즈니스 로직에서 관리할 책임이 없기 때문에 포함하지 않습니다.
- 상태를 나타내는 필드, 특정 행동을 가지는 메서드를 포함하기도 합니다.

> 💡 그러면 Entity는 Domain 객체가 아닐까요?


저는 꼭 둘이 일치한다고 생각하지 않습니다. Entity는 DB의 Table를 추상화한 객체입니다. 그리고 DB의 테이블이 모든 프로덕트의 데이터를 들고 있는 것이 맞습니다. 하지만 Entity가 Domain 객체를 오롯이 담당하기에는 한계가 있습니다.

1. DB의 데이터가 항상 서비스 로직에 사용하기 적합하다는 보장은 없습니다.
2. DB의 연관관계를 Entity로 모두 표현 할 수는 있지만, 실제 런타임에 Entity가 모든 연관관계 데이터를 들고 있기에는 물리적인 한계가 존재합니다.


#### 2.2. 영속성 계층(Repository)로 typeorm의 entity를 격리하자.


> 📌 영속성 계층(Repository) 대한 자세한 설명은 “[**Repository 패턴에서 ‘명시적 트랜잭션’ 올바르게 사용하는 방법**](https://dbwogus94.github.io/posts/%EA%B0%9C%EB%B0%9C-Typescript-Repository-%ED%8C%A8%ED%84%B4%EC%97%90%EC%84%9C-%EB%AA%85%EC%8B%9C%EC%A0%81-%ED%8A%B8%EB%9E%9C%EC%9E%AD%EC%85%98-%EC%98%AC%EB%B0%94%EB%A5%B4%EA%B2%8C-%EC%82%AC%EC%9A%A9%ED%95%98%EB%8A%94-%EB%B0%A9%EB%B2%95/)**”** 포스팅을 참고해 주세요


3 계층 아키텍처에서는 영속성 계층을 사용해 DB와 통신하는 코드를 격리할 수 있습니다. 하지만 앞서 설명처럼 영속화 계층에서 Entity를 리턴하게 되면 type-safe를 보장하지 못하는 문제가 생깁니다.


그렇기에 조회 로직에서 리턴되는 결과를 Domain 객체로 매핑합니다. Domain 객체는 항상 동일한 type를 보장하며, Type Safe하게 사용이 가능합니다.


**중요한 점은 영속성 계층은 항상 동일한 Domain을 응답하도록 코드를 작성해야 합니다.**



#### 2.3. 실제 구현한 코드를 통해 동작 확인


![4](/assets/img/2024-04-02-프로젝트--똑소-Type-Safe-하지-못한-Typeorm-도메인-객체로-해결해-보았다..md/4.png)

1. `ProductRepository`: Product Entity를 사용하는 orm 로직을 격리하고 모듈화합니다.


{% raw %}
```typescript
export abstract class ProductRepositoryPort extends BaseRepository<ProductEntity> {
  abstract findManyAndCount(
    options?: FindManyOptions,
  ): Promise<[Product[], number]>;
  // ... 생략
}

@Injectable()
export class ProductRepository extends ProductRepositoryPort {
  // constructor 생략
  
  override async findManyAndCount(
    options: FindManyOptions,
  ): Promise<[Product[], number]> {
    // ...생략
    const [products, count] = await this.#findManyAndCount(options);
    return [ProductEntityMapper.toDomain(products), count];
  }
}
```
{% endraw %}


1. `ProductEntityMapper`: `ProductEntity`를 `Product` 객체로 변환합니다.


{% raw %}
```typescript
export class ProductEntityMapper {
  static toDomain(entity: ProductEntity[]): Product[];
  static toDomain(entity: ProductEntity): Product;
  static toDomain(
    entity: ProductEntity | ProductEntity[],
  ): Product | Product[] {
    if (Array.isArray(entity)) 
      return entity.map((e) => this.toDomain(e));
    
    const { price, ...pureProduct } = entity;
    const { isStock, ...other } = pureProduct;
    return new Product({
      ...other,
      isStock: !!isStock, // DB와 스키마 차이 보정
      price: ProductPriceEntityMapper.toDomain(price),
    }).setBase(entity.id, entity.createdAt, entity.updatedAt, entity.deletedAt);
  }
}
```
{% endraw %}


1. `Product`: 상품에 대한 비즈니스 규칙을 구현한 객체 입니다.


{% raw %}
```typescript
interface ProductProps {
  id: string;
  title: string;
  imageUrl: string;
  isStock: boolean;
  price: ProductPriceEntity;
  productCategories: ProductCategoryEntity[];
}

class Product {
  constructor(readonly props: ProductProps) {}

  get id(): string {
    return this.props.id;
  }
  // ...생략 
}
```
{% endraw %}


1. `ProductService`: 비즈니스 로직을 구현한 계층이며, Domain 객체를 직접 사용합니다.


{% raw %}
```typescript
export abstract class ProductServiceUseCase {
  abstract getProducts(
    query: GetProductsQuery,
  ): Promise<GetProductsResponseWithTotalCount>;
	// ... 생략
}

@Injectable()
export class ProductService extends ProductServiceUseCase {
  // constructor 생략

  override async getProducts(
    query: GetProductsQuery,
  ): Promise<GetProductsResponseWithTotalCount> {
    const { state, sort, categoryId, brandId, tag, ...pagination } = query;
    
    const [products, totalCount] = await this.productRepo.findManyAndCount({
      where: { state, tag, categoryId, brandId },
      sort,
      pagination,
    });

    return GetProductsResponseWithTotalCount.of({
      results: products,
      totalCount,
    });
  }
}
```
{% endraw %}




## 마무리


현재 구현된 방법도 완벽하게 Type Safety하게 만들기는 어렵습니다. 
Mapper에서 타입 체크가 완벽하게 수행되지 않으면 런타임 에러가 발생할 수 있기 때문입니다.


또한 항상 동일한 Domain 객체를 내보내기 위해 오버패칭이 발생할 수 있다는 단점도 가지고 있습니다.


그럼에도 이러한 방법을 사용해 더 안전한 Type, 명확한 코드분리와 책임을 얻을 수 있습니다.



#### 2024년 12월 생각 추가


부족함을 인지하고 9월부터 10주간 성장을 위해 항해 플러스라는 코스를 진행했습니다. 과정을 진행하며 여러 백엔드 시니어 개발자 분들이 생각하시는 도메인 객체에 대한 생각을 엿볼 수 있었습니다.


그리고 ORM Entity와 Domain 객체에 대한 생각은 자연스럽게 “도메인 모델링”과 “아키텍처 그리고 테스트 가능한 코드”에 대한 고찰로 이어졌습니다. 


관련 포스팅이 정리되면 하단에 링크를 추가하겠습니다.

