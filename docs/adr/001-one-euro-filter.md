# 001 — 부드러운 화면을 위한 One Euro Filter 사용

## 배경

카메라(또는 다른 객체 인식 장치)에 의한 객체 추적 결과는 보정이 필요.
미세한 떨림과 입력 지연과 같은 상황에 대비 요구.

## 방법

### A. 고정 cut-off low-pass 필터

직전 출력과 새 값을 정해진 비율로 섞는다.

장점
1. 간단한 구현
2. 매우 저렴한 연산 비용

단점
1. 떨림 억제와 빠른 반응을 동시에 만족 불가
2. 보정을 세게 하면 빠른 움직이 느려짐
3. 보정을 약하게 하면 멈췄을 때 떨림

참고: [Exponential smoothing (Wikipedia)](https://en.wikipedia.org/wiki/Exponential_smoothing)

### B. 칼만 필터(Kalman Filter)

위치와 속도를 상태로 두고 예측과 보정을 반복한다.

장점
1. 속도까지 추정하므로 관측이 잠시 끊겨도 예측 보정 가능

단점
1. 높은 구현 난이도와 시간

참고: [An Introduction to the Kalman Filter — Welch & Bishop](https://www.cs.utexas.edu/~pstone/Courses/393Rfall15/readings/Welch+Bishop-TR-95.pdf)

### C. One Euro Filter — 채택

추정한 속도에 따라 cut-off를 매 프레임 조절한다.
멈춰 있으면 강하게, 움직이면 약하게 보정한다.

장점
1. 간단한 구현
2. Chrome·Unreal Engine 등 실제 소프트웨어에서 쓰이는 검증된 방식.

단점
1. 예측 모델이 없어 관측이 끊긴 구간은 보정 불가
2. 급가속 순간에는 cut-off가 올라가면서 떨림도 함께 통과

참고: [One Euro Filter 공식 페이지](https://gery.casiez.net/1euro/) ·
[CHI 2012 논문](https://dl.acm.org/doi/10.1145/2207676.2208639)

## 결정
One Euro Filter를 채택한다.

반응 속도를 실제로 재면서
minCutoff=1.2, beta=1.4까지 올렸다.

## 결과

- 멈췄을 때의 떨림이 눈에 띄게 줄었고, 빠른 움직임의 반응 속도는 허용 지연 임계값 근처에 머문다.
  맡는다. 역할을 나눠 둔 덕분에 둘을 각각 따로 조정할 수 있다.
