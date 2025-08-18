---
layout: post
date: 2025-01-12
title: "[프로젝트 | 똑소] AWS 해킹 2편 - 범인은 “AWS SSO SAML(portal)”"
tags: [AWS, 해킹, ]
categories: [프로젝트, 똑소, ]
mermaid: true
---


> 📌 해당 포스트는 “AWS 해킹 1편 - root 권한 해킹, ECS 순식간에 1000달러 비용 발생” 포스트와 내용이 이어집니다.  


**🔎 연결문서**

- [AWS 해킹 1편 - root 권한 해킹, ECS 순식간에 1000달러 비용 발생](https://dbwogus94.github.io/posts/%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%EB%98%91%EC%86%8C-AWS-%ED%95%B4%ED%82%B9-1%ED%8E%B8-root-%EA%B6%8C%ED%95%9C-%ED%95%B4%ED%82%B9,-ECS-%EC%88%9C%EC%8B%9D%EA%B0%84%EC%97%90-1000%EB%8B%AC%EB%9F%AC-%EB%B9%84%EC%9A%A9-%EB%B0%9C%EC%83%9D/)
- [AWS 해킹 2편 - 범인은 “AWS SSO SAML(portal)”](https://dbwogus94.github.io/posts/%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%EB%98%91%EC%86%8C-AWS-%ED%95%B4%ED%82%B9-2%ED%8E%B8-%EB%B2%94%EC%9D%B8%EC%9D%80-AWS-SSO-SAML(portal)/)


### 1. 24년 11월 01일에 1차 해킹과 동일한 증상 발생을 확인한다.


동일하게 모든 리전의 ECS 클러스터가 20개 이상 생성되어 있는 것을 확인


![0](/assets/img/2025-01-12-프로젝트--똑소-AWS-해킹-2편---범인은-“AWS-SSO-SAMLportal”.md/0.png)


생성된 테스트 권한 정보 확인 - `amplify-login-lambda-b59ae5fe/root`



{% raw %}
```json
{
    "taskDefinitionArn": "arn:aws:ecs:ap-northeast-2:xxxx:task-definition/CcmZoAgVMpOVoHTKySQUumIsm:1",
    "containerDefinitions": [
        {
            "name": "CcmZoAgVMpOVoHTKySQUumIsm",
            "image": "fc4mx35oq/sa:ki",
            "cpu": 0,
            "portMappings": [],
            "essential": true,
            "command": [],
            "environment": [],
            "mountPoints": [],
            "volumesFrom": [],
            "systemControls": []
        }
    ],
    "family": "CcmZoAgVMpOVoHTKySQUumIsm",
    "networkMode": "awsvpc",
    "revision": 1,
    "volumes": [],
    "status": "ACTIVE",
    "requiresAttributes": [
        {
            "name": "ecs.capability.increased-task-cpu-limit"
        },
        {
            "name": "com.amazonaws.ecs.capability.docker-remote-api.1.18"
        },
        {
            "name": "ecs.capability.task-eni"
        }
    ],
    "placementConstraints": [],
    "compatibilities": [
        "EC2",
        "FARGATE"
    ],
    "requiresCompatibilities": [
        "FARGATE"
    ],
    "cpu": "16384",
    "memory": "32768",
    "registeredAt": "2024-11-01T13:18:57.402Z",
    "registeredBy": "arn:aws:sts::xxxxx:assumed-role/amplify-login-lambda-b59ae5fe/root",
    "tags": []
}
```
{% endraw %}




### 2. 원인 찾기


처음에는 많이 당황했다. AWS IAM의 사용자와 역할을 모두 정리했고, 모든 사용자의 Password를 변경하고 2차 인증인 MFA까지 설정했기 때문이다. 그럼에도 해킹범은 console로 들어와서 iam 역할 신규로 만들고 그 역할로 다시 ECS를 활성화 시켰다. 


**어떻게 들어왔을까?**  다행히 `CloudTrail`에서 단서를 찾을 수 있었다.


**범인은** **`AWS SSO SAML`** **때문이었다.**



#### 2.1. AWS SSO


> Single Sign-On(SSO)은 1회 사용자 인증으로 다수의 애플리케이션 및 웹사이트에 대한 사용자 로그인을 허용하는 인증 솔루션입니다.  
> 출처: [AWS | ](https://aws.amazon.com/what-is/sso/)[**SSO(Single Sign On)란 무엇인가요?**](https://aws.amazon.com/what-is/sso/)[ ](https://aws.amazon.com/what-is/sso/)


쉽게 말하면 Password를 사용해서 매 번 인증을 하는 것은 위험할 수 있기 때문에 Password 없이 로그인 가능한 수단을 제공하는 기술이다. (대표적으로 구글 로그인, 네이버 로그인 같은 `OAuth`가 여기에 포함된다.)


AWS SSO에서 지원하는 유형은 4가지가 있다.

- **SAML**
- OAuth
- OIDC
- Kerberos

이중에 해킹에 사용된 방법은 **`AWS SSO SAML`** 였다.


> SAML 또는 Security Assertion Markup Language는 애플리케이션이 SSO 서비스와 인증 정보를 교환하는 데 사용하는 프로토콜 또는 규칙 집합입니다. **SAML은 브라우저 친화적인 마크업 언어인 XML을 사용하여 사용자 식별 데이터를 교환합니다**. SAML 기반 SSO 서비스는 애플리케이션이 사용자 보안 인증 정보를 시스템에 저장할 필요가 없으므로 더 나은 보안과 유연성을 제공합니다.



#### 2.2. IAM > ID 제공업체에서 **`AWS SSO SAML`** **공급자를 제거하자.**


![1](/assets/img/2025-01-12-프로젝트--똑소-AWS-해킹-2편---범인은-“AWS-SSO-SAMLportal”.md/1.png)


`AWSSSO_7ff93c0824acf3a0_DO_NOT_DELETE` 수상한 이름의 공급자가 보인다.


해당 콘솔에 들어가면 **`AWS SSO SAML`**을 수행하는 XML 파일을 다운 받을 수 있다.


XML 파일: `AWSSSO_7ff93c0824acf3a0_DO_NOT_DELETE`의 XML 파일



{% raw %}
```xml
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://portal.sso.us-east-1.amazonaws.com/saml/assertion/NDIxNzE3MDY5MDU0X2lucy1iZmIwOWE2ZjhjMzRmNWM4">
<md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
<md:KeyDescriptor use="signing">
<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ds:X509Data>
<ds:X509Certificate>
MIIDBjCCAe6gAwIBAgIEMjuvZTANBgkqhkiG9w0BAQsFADBFMRYwFAYDVQQDDA1hbWF6b25hd3MuY29tMQ0wCwYDVQQLDARJREFTMQ8wDQYDVQQKDAZBbWF6b24xCzAJBgNVBAYTAlVTMB4XDTI0MTAwNDAzMzI0OFoXDTI5MTAwNDAzMzI0OFowRTEWMBQGA1UEAwwNYW1hem9uYXdzLmNvbTENMAsGA1UECwwESURBUzEPMA0GA1UECgwGQW1hem9uMQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANw3JV/r2eYouGlsGeRo1iWRzYTEa19aSTJBVHkvlD7csNxrQ8rus5uCPQBOEqMPO82kLk5rR+Ylfloy+P56d+7kulbtrW0i2715l3CNli94lhEbX1xOvA/snlZdFKT5nAug8QPwtxElfwv7+4S5JiI4MtPsxBQTj7XIWeyq0WV/8bav/tawGKk4nSgRT7JoIKP/MMwMOrYtnR3ffmJ4b1sVtAeSG4FafHogMzLnatqG2jh5UszgM/uxS2NoJWlKIHYFtr1e3KdKsFQQKAgM+fwd4yI1jSqZ4gFdakUVkC7cMToXLt1e41klxUZ5xcV1GNeLsStT3WoKkZpFMYGoqZsCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAshtbitIE0lL90yWLNP/wqfFscAAv5EK4ojP8bJpvvpM9Umwq0oqmzB/rSW/emKDFpzJqNL82ooBjNoDrEuhixRg65TMS//Go2b85T8u9G//SbDjdBhkiArdd+6OM7bg3UVqqxPIAH/b1K3sL0yDI5u1ZTTjFoNdROvToWtlk+w351T39i6wQ9kbLTtKYuGDkIuHy7LUwemfasaBjR4YDKEO5eq/CkyW0zZwUu2yGpzMmohRPiMpW/GDx+yH8jz9zHyxnei98lsdXRKj74Dm609214MmOHQHld9EQ+pSaUVabrqIqKVuIkOeFqw12Y/FmIbCDGTThM+Alqbn38ZE6ew==
</ds:X509Certificate>
</ds:X509Data>
</ds:KeyInfo>
</md:KeyDescriptor>
<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://portal.sso.us-east-1.amazonaws.com/saml/logout/NDIxNzE3MDY5MDU0X2lucy1iZmIwOWE2ZjhjMzRmNWM4"/>
<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://portal.sso.us-east-1.amazonaws.com/saml/logout/NDIxNzE3MDY5MDU0X2lucy1iZmIwOWE2ZjhjMzRmNWM4"/>
<md:NameIDFormat>
urn:oasis:names:tc:SAML:2.0:nameid-format:persistent
</md:NameIDFormat>
<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://portal.sso.us-east-1.amazonaws.com/saml/assertion/NDIxNzE3MDY5MDU0X2lucy1iZmIwOWE2ZjhjMzRmNWM4"/>
<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://portal.sso.us-east-1.amazonaws.com/saml/assertion/NDIxNzE3MDY5MDU0X2lucy1iZmIwOWE2ZjhjMzRmNWM4"/>
</md:IDPSSODescriptor>
</md:EntityDescriptor>
```
{% endraw %}



그리고 XML 파일에 있는 로그인 URL로 페이지에 접근하면 아래와 같은 페이지가 뜬다.


![2](/assets/img/2025-01-12-프로젝트--똑소-AWS-해킹-2편---범인은-“AWS-SSO-SAMLportal”.md/2.png)


지금은 제거해서 들어가지지 않지만 저기에 사용자 이름을 입력하면 자동으로 AWS 콘솔에 로그인이 수행된다.




#### 2.3. (추가) IAM 역할에서 `cognito-identity.amazon` 신뢰할 수 있는 객체의 의미


`cognito-identity.amazon`가 신뢰할 수 있는 객체라고 모두 문제인건 아니다. 


하지만 이번 케이스의 경우 `cognito-identity.amazon` 가 만든 역할은 모두 문제가 되는 역할이다.


![3](/assets/img/2025-01-12-프로젝트--똑소-AWS-해킹-2편---범인은-“AWS-SSO-SAMLportal”.md/3.png)


공식문서를 확인하면 이렇게 나와 있다.


![4](/assets/img/2025-01-12-프로젝트--똑소-AWS-해킹-2편---범인은-“AWS-SSO-SAMLportal”.md/4.png)

- 참고: [https://docs.aws.amazon.com/ko_kr/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html#STS-API-SAML-WIF](https://docs.aws.amazon.com/ko_kr/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html#STS-API-SAML-WIF)

정리하면 `cognito-identity.amazon`는 SMALUser로 생성된 경우만 나타난다는 내용이다.



### 3. 마무리


“IAM > ID 제공업체에서 **`AWS SSO SAML`** **공급자를 제거**” 이후 현재(25년 3월 갱신)까지 더 이상의 해킹은 발생하지 않고 있다.


이번에 해킹을 당하면서 AWS에 대한 공부를 실천으로 할 수 있는 기회가 되었지만, 쉽지 않았다.


그리고 한 번 더 느낀 문제지만 GPT의 도움을 받는 것도 배경지식이 없다면 한계가 있다는 것을 또 다시 절실하게 느꼈다. 앞으로도 많은 공부와 경험이 필요할 것으로 여겨진다.


---



### 참고


AWS SSO 참고

- [https://aws.amazon.com/ko/blogs/aws/enable-single-sign-on-to-the-aws-management-console/](https://aws.amazon.com/ko/blogs/aws/enable-single-sign-on-to-the-aws-management-console/)
- [https://aws.amazon.com/what-is/sso/](https://aws.amazon.com/what-is/sso/)
- [https://www.smileshark.kr/post/hidden-holes-in-iam-account-management-enhancing-account-security-with-aws-sso](https://www.smileshark.kr/post/hidden-holes-in-iam-account-management-enhancing-account-security-with-aws-sso)
