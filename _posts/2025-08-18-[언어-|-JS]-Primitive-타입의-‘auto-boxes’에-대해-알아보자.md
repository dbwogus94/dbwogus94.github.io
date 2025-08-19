---
layout: post
date: 2025-08-18
title: "[언어 | JS] Primitive 타입의 ‘auto-boxes’에 대해 알아보자"
tags: [JS, 이론, ]
categories: [언어, JS/TS, ]
mermaid: true
---


> 📌 Javascript의 `'' instanceof String` 가 `true`가 아닌 이유와 그럼에도 `''.replace()`로 String 객체의 메서드에 접근 할 수 있는 이유에 대해 설명합니다.



### 0. 글 작성 배경


JS/TS를 사용해 코드를 작성할때 타입이 문자열이 맞는지 확인하려면 일반적으로 `typeof`를 사용합니다. 문득 Java를 사용할 때가 생각나 개발자 콘솔에서 `instanceof`를 사용해서 판별을 해보았습니다.

- `'' instanceof String`: 리터럴 문자열이 String의 인스턴스인가?
- `new String() instanceof String`: new로 생성된 String 인스턴스가 String의 인스턴스인가?

위 코드 모두 `true`를 반환할 것이라고 기대 했지만 `'' instanceof String`은 `false`를 반환합니다. JS를 사용할 때 한 번씩 발생하는 당황스러운 상황입니다. 곧 바로 이유를 찾아보니 합리적인 이유가 있었습니다.


저 처럼 개발 시작을 Java로 접한 사람들에게는 다소 혼란스러운 상황이 될 것 같아 포스팅으로 남기기로 합니다.



### 1. 코드로 문제의 상황 확인



#### **Java의 문자열 판별 결과**



{% raw %}
```java
System.out.println("" instanceof String);        
>>> true
System.out.println(new String("") instanceof String); 
>>> true
```
{% endraw %}



Java의 경우 문자열 리터럴(`””`)도 `String`생성자로 인스턴스화된 인스턴스도 결국 힙 영역에 `String`의 인스턴스로 관리되는 것을 확인할 수 있습니다.



#### **Javascript의 문자열 판별 결과**



{% raw %}
```java
'' instanceof String
>>> false

new String() instanceof String
>>> true
```
{% endraw %}



Javascript의 경우 문자열 리터럴의 경우 `String`의 인스턴스가 아니라는 것을 확인할 수 있습니다.



#### **Javascript 프로토타입 확인**



{% raw %}
```javascript
''.__proto__
>>> String {'', anchor: ƒ, at: ƒ, big: ƒ, blink: ƒ, …}

new String().__proto__
>>> String {'', anchor: ƒ, at: ƒ, big: ƒ, blink: ƒ, …}
```
{% endraw %}



이제 이해하기 어려운 결과를 볼 수 있다. 개발자 도구에서 리터럴 문자열의 프로토타입을 출력하면 `String`이 출력된다. 


여기까지 정리하면 모순적인 결론이 나옵니다. 
**”문자열 리터럴은** **`String`****의 인스턴스가 아니지만 프로토타입은** **`String`****를 사용한다.”**


혼란스러운가요? 저는 그랬습니다. 프로토타입 기반의 언어인 Javascript에서 이러한 결론은 제가 이해하고 있는 Javascript라는 언어의 근본을 흔들었기 때문입니다. 그리고 지금부터 왜 이런 동작을 하는지 차근 차근 보려합니다.



### 2. Javascript와 Java의 문자열 관리 비교


먼저 두 언어의 원시타입과 문자열이 메모리에서 어떻게 관리되는지 간단하게 알아보겠습니다.



#### Java의 메모리 할당


일반적으로 Java는 3가지 메모리 영역을 사용합니다.

- Method(Static) 메모리 영역
- Heep 메모리 영역
- Stack 메모리 영역

클래스 기반의 언어인 Java는 어떻게 선언되는지에 따라 메모리에 할당되는 영역이 달라집니다.

1. **Method에 선언된 변수는 Stack 메모리의 지역변수에 할당**


{% raw %}
```java
public void method() {
    String str = "";        // Heap의 String pool에 저장
    int num = 100;        // Stack에 저장
}
```
{% endraw %}


1. **인스턴스 변수는 Heep 메모리에 저장**


{% raw %}
```java
public class MyClass {
    private String str = "";   // Heap에 저장 (인스턴스화된 객체와 함께)
    private int num = 100;     // Heap에 저장 (인스턴스화된 객체와 함께)
}
```
{% endraw %}


1. **클래스 변수는 Method 메모리에 저장**


{% raw %}
```java
public class Constants {
    public static int num = 100;     // Method Area
    public static String str = "";   // 참조값은 Method Area, 실제 객체는 Heep
}
```
{% endraw %}




#### Javascript의 메모리 할당


**반면 Javascript는 2가지 메모리 영역만 사용합니다.**

- Heep 메모리 영역
- Stack 메모리 영역

그리고 일반적으로 Javascript는 모든 값은 Heep에 할당됩니다. 


Javascript도 Java와 같이 크게 **‘원시타입(Primitive Type)’**와 **‘참조타입(Reference Type)’**이 존재합니다. 하지만 Java와 다르게 모든 값은 Heep에 저장되어 관리됩니다.


“원시타입이 힙에 저장되기 때문에 객체인거 아니야?”라고 오해 할 수 있습니다.


하지만 NDN에 따르면 Javascript의 원시타입은 <u>객체가 아니며 메서드나 속성을 갖지 않는 데이터</u>입니다.


👉🏻 원시타입은 ‘원칙상 모든 값이 힙에 저장’ 되어야 하지만 엔진별 최적화에 따라 스택에 저장되기도 합니다.
- 출처: [**JS 탐구생활 - JS의 값은 스택과 힙 중 어디에 저장되는가?**](https://witch.work/ko/posts/javascript-trip-of-js-value-where-value-stored)



### 3. MDN에 설명된 Primitive 타입 동작 확인


> **Primitive**  
> In JavaScript, a **primitive** (primitive value, primitive data type) is data that is not an object and has no methods or properties.   
>   
> There are 7 primitive data types:  
> - string  
> - number  
> - bigint  
> - boolean  
> - undefined  
> - symbol[  
> ](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)- null  
>   
> Most of the time, a primitive value is represented directly at the lowest level of the language implementation.  
>   
> All primitives are _immutable_; that is, they cannot be altered. It is important not to confuse a primitive itself with a variable assigned a primitive value. The variable may be reassigned to a new value, but the existing value can not be changed in the ways that objects, arrays, and functions can be altered. The language does not offer utilities to mutate primitive values.


→ _Javascript에는 7가지 원시타입이 존재하며, 객체가 아니기 때문에 메서드와 속성이 존자하지 않습니다. 그리고 모든 원시타입은 변경 불가능한 불변성을 가집니다._


여기까지는 다른 언어와 크게 다르지 않은 원시타입의 설명 같습니다. 하지만 이 다음의 설명을 보면 Javascript의 원시타입에 대한 <u>독특한 동작</u>이 명시되어 있습니다.


> Primitives have no methods but still behave as if they do. When properties are accessed on primitives, JavaScript **’**_auto-boxes’_ the value into a wrapper object and accesses the property on that object instead. For example, `"foo".includes("f")` implicitly creates a `String` wrapper object and calls `String.prototype.includes()` on that object. This auto-boxing behavior is not observable in JavaScript code but is a good mental model of various behaviors — for example, why "mutating" primitives does not work (because `str.foo = 1` is not assigning to the property `foo` of `str` itself, but to an ephemeral wrapper object).


→ _원시타입은 메서드가 없지만, 마치 메서드가 있는 것처럼 동작합니다. 원시타입에 속성에 접근하면 Javascript는 원시값을 래퍼객체에 ‘auto-boxes’합니다._


_예를 들어_ _`"foo".includes("f")`__를 호출하면 암시적으로_ _`String`_ _객체가 생성되어_ _`String.prototype.icludes()`__가 호출됩니다. 이러한 ‘auto-boxes’_ _기능은 Javascript 코드에서 직접 확인은 할 수 없지만, 다양한 동작에 대한 좋은 모델입니다._ 


_예를 들어 원시타입 속성에 대한 “변형”하는 것은 왜 동작하지 않는가?
(__`str.foo = 1`__은 str 원시타입의 foo 속성에 할당하는 것이 아니라 임시 래퍼 객체에 할당하기 때문입니다.)_


**”문자열 리터럴은** **`String`****의 인스턴스가 아니지만 프로토타입은** **`String`****를 사용한다.”** 이러한 모호한 동작이 나왔던 이유에 대한 이유를 찾았습니다.



### 4. JS의 원시타입과 ‘auto-boxes’ 동작 알아보기


> 💡 정리하면 Javascript의 원시타입(**Primitive**)은 불변성을 가지며, 메서드도 속성도 없는 값입니다. 하지만 Javascript는 원시타입에 편의성을 위해 ‘auto-boxes’라는 기술을 제공합니다.


auto-boxes의 동작은 간단하게 설명하면 원시타입에 임시로 객체의 기능을 빌려주는 것과 같습니다.

- `string` → `String` 객체의 기능 사용
- `number` → `Number` 객체의 기능 사용
- `boolean` → `Boolean` 객체의 기능 사용

그리고 작업이 완료되면 임시 객체는 제거(GC)됩니다. 이는 Javascript의 내부에서 암시적으로 수행됩니다. 



#### 예시 1) string 원시 타입에서 String의 속성에 접근



{% raw %}
```javascript
const primitiveStr = 'auto-boxes';
console.log(primitiveStr.length);  // 임시적을 new String(primitiveStr) 생성
>>> 10
```
{% endraw %}



내부 동작을 나열하면 다음과 같은 일이 일어납니다.

1. `primitiveStr`에  원시타입 string이 할당됩니다.
2. `primitiveStr.length` 호출되면 `String` 임시 객체가 생성됩니다.
3. 그리고 생성된 String 객체의 lenght 속성에 접근해 결과를 가져옵니다.
4. 마지막으로 결과가 반환되고 임시 객체는 GC 대상이 됩니다.


#### 예시 2) string 원시 타입 속성에 값을 할당



{% raw %}
```javascript
const str = 'primitiveStr';
str.count = 1;               // 임시적으로 new String(str) 생성
console.log(str.count);      // 임시적으로 new String(str) 생성
>>> undefined
```
{% endraw %}



내부 동작을 나열하면 다음과 같은 일이 일어납니다.

1. `str`에  원시타입 string이 할당됩니다.
2. `str.count`가 호출되면 String 임시 객체가 생성됩니다.
3. 그리고 생성된 String 객체의 `.count` 속성에 1이 할당됩니다.
4. 이후 String 객체는 GC 대상이 됩니다.
5. 마지막으로 str.count를 호출하면 다시 신규 String 임시 객체가 생성되기 때문에 `undefined`가 출력됩니다.


### 5. 마무리


해당 포스팅의 시작이 되었던 동작을 다시 한 번 정리해보겠습니다.



{% raw %}
```java
// 1. instanceof로 리터럴 문자열 판별
'' instanceof String
>>> false

// 2. 리터럴 문자열에 __proto__ 타입 접근
''.__proto__
>>> String {'', anchor: ƒ, at: ƒ, big: ƒ, blink: ƒ, …}
```
{% endraw %}


1. 원시타입인 `string`는 `String`의 인스턴스가 아니기 때문에 `false`가 나옵니다.
2. 리터럴 문자열에 `__proto__` 속성에 접근하면 auto-boxes에 의해 임시 String 인스턴스가 생성됩니다.
	1. `''.__proto__` → `new String(’’)` 생성되고 `.__proto__` 속성의 값을 리턴합니다.
	2. 결과를 반환하면 해당 임시 `new String(’’)`는 GC 대상이 됩니다.

여기까지 JavaScript의 원시타입과 **auto-boxing**이 실제로 어떻게 동작하는지 살펴보았습니다.


처음에는 **“문자열 리터럴은 String의 인스턴스가 아니지만 프로토타입은 String을 사용한다”**라는 모순된 현상이나, 원시타입에 메서드와 속성이 존재하는 것처럼 보이는 현상이 꽤 혼란스럽게 느껴질 수 있습니다.


저 역시 한동안 JavaScript의 원시타입이 힙에 저장되고 객체처럼 동작하기 때문에, 객체의 메서드와 속성에 자연스럽게 접근할 수 있다고 오해하곤 했습니다. 그래서 **`'' instanceof String`**이 **`false`**를 반환하는 결과를 마주했을 때 가장 큰 혼동을 느꼈습니다.


이번 글이 JavaScript에서 원시타입이 실제로 어떻게 동작하고, auto-boxing이 어떤 원리로 구현되어 있는지 이해하는 데 조금이나마 도움이 되었으면 합니다.


---



### **참고**

- [**MDN | Primitive**](https://developer.mozilla.org/en-US/docs/Glossary/Primitive)
- [**DEV | Javascript Autoboxing**](https://dev.to/mmvergara/javascript-autoboxing-25jb)
- [**Stack Overflow | Why are JavaScript primitives not instanceof Object?**](https://stackoverflow.com/questions/17938680/why-are-javascript-primitives-not-instanceof-object)
- [**ECMAScript에서 auto-boxes에 대한 명세**](https://interglacial.com/javascript_spec/a-9.html)
- [**JS 탐구생활 - JS의 값은 스택과 힙 중 어디에 저장되는가?**](https://witch.work/ko/posts/javascript-trip-of-js-value-where-value-stored)
