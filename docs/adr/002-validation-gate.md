# 002 — 좌표 검사

## 배경
장치 오류에 따른 노이즈 식별하여 유저 경험 향상

## 방법

### A. 식별하지 않는다.
장점
1. 비용 감소.

단점
1. 노이즈 판별과 객체 판별을 같은 단계에서 수행해야 함.

참고: [Introduction to Multiple Target Tracking — gating과 assignment의 역할 분리 (MathWorks)](https://www.mathworks.com/help/fusion/ug/introduction-to-multiple-target-tracking.html)

### B. 이동 속도로 거른다 — 채택

한 프레임안에서 물리적으로 가능한 임계값을 검사.

장점
1. 물리적인 제약은 장치를 바꿔도 성립.
3. 화면 반대편으로 튀는 값은 방지.
   
단점
1. 임계값은 하드웨어에 의존.
2. 일부 빠른 움직임은 검사 불가능

참고: [Introduction to Multiple Target Tracking — gating (MathWorks)](https://www.mathworks.com/help/fusion/ug/introduction-to-multiple-target-tracking.html)

## 결정
이동 속도 기준으로 거른다.

## 결과
- 화면 반대편으로 순간이동하는 증상 사라짐.
- 실시간 모드에서 마우스를 아주 빠르게 움직이면 조준점이 잠깐 사라지는데, 고장이 아니라 이 검사가 작동한 결과.
