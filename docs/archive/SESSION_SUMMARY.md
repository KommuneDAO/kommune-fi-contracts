# KommuneFi Vault 세션 요약 및 문제점 분석

## 📅 작업 일자: 2025-08-13

## 🎯 세션 목표
KommuneFi Vault의 deposit/withdrawal 문제 해결 및 포괄적인 테스트 수행

## 📝 주요 작업 내용

### 1. 초기 상태 확인
- 이전 세션에서 발견된 "WETH: request exceeds allowance" 에러 조사
- 기존 배포된 컨트랙트 상태 확인 (0x77270A884A3Cb595Af3F57Dc795bAC3E14Ab23e8)
- Vault에 이미 wrapped LST 토큰들이 남아있는 상태 확인

### 2. 테스트 스크립트 작성
#### 생성된 테스트 파일:
- **comprehensiveWithdrawTest.js**: 순차적 deposit/withdraw 패턴 테스트
- **fullIntegrationTest.js**: 다중 사용자 프로덕션 환경 시뮬레이션
- **systematicDepositWithdrawTest.js**: 체계적인 deposit/withdraw 비율 테스트

### 3. 문제 재현 및 분석
- 기존 배포에서 모든 withdrawal 실패 확인
- 새로운 컨트랙트 배포 시도 (총 3회)
- 각 배포마다 동일한 문제 패턴 발견

### 4. 배포 이력
| 시간 | 컨트랙트 주소 | 결과 |
|------|--------------|------|
| 초기 | 0x77270A884A3Cb595Af3F57Dc795bAC3E14Ab23e8 | 문제 발생 |
| 1차 재배포 | 0xb89FF45DF989149BEf0580dFFAF0756B753355E2 | 동일 문제 |
| 2차 재배포 | 0xc740f416Fa176d1d8c0BD3335BE4f3549c89c39a | 동일 문제 |

## 🔴 핵심 문제점

### 1. Deposit 문제
- **증상**: 첫 번째 deposit 항상 실패
- **에러**: `execution reverted: WETH: request exceeds allowance`
- **패턴**: 홀수 번째 deposit 실패 (1, 3, 5번째), 짝수 번째 성공 (2, 4번째)
- **성공률**: 40% (2/5)

### 2. Withdrawal 문제
- **증상**: 모든 withdrawal 실패
- **에러**: 트랜잭션 revert (구체적 에러 메시지 없음)
- **성공률**: 0% (0/18 시도 중 0 성공)
- **테스트된 비율**: 10%, 30%, 50%, 70%, 90% 모두 실패

### 3. 상태 누적 문제
- APY 변경 후 deposit 실패율 증가
- 여러 번 deposit 후 시스템 불안정
- Fresh deployment에서도 동일 문제 발생

## 🔍 문제 원인 분석

### 가능성 높은 원인:
1. **Wrapping 로직 버그**
   - LST 토큰을 wrapped 버전으로 변환 시 allowance 관리 문제
   - 첫 번째 시도 시 초기화 문제

2. **Withdrawal 프로세스 결함**
   - Unwrapping 과정에서 권한 문제
   - Swap 계산 또는 실행 오류
   - Slippage 처리 문제

3. **상태 관리 문제**
   - 홀수/짝수 패턴은 토글 상태나 플래그 관리 오류 암시
   - 컨트랙트 내부 상태가 제대로 초기화되지 않음

## 📊 테스트 결과 요약

### comprehensiveWithdrawTest.js 결과:
- Scenario 1: Sequential Pattern - 모든 작업 실패
- Scenario 2: APY Changes - APY 변경 성공, deposit/withdraw 실패
- Scenario 3: Stress Test - 대부분 실패
- Scenario 4: Edge Cases - 100% withdrawal 실패

### fullIntegrationTest.js 결과:
- Multi-user simulation: Deposit 61% 성공, Withdrawal 0% 성공
- APY volatility: 모든 withdrawal 실패
- System health score: 40% (프로덕션 배포 불가)

### systematicDepositWithdrawTest.js 결과:
- 5회 deposit 중 2회만 성공 (2, 4번째)
- 모든 withdrawal percentage (10%, 30%, 50%, 70%, 90%) 실패
- Vault solvency는 정상 유지

## 🛠️ 다음 세션에서 필요한 작업

### 1. 컨트랙트 코드 수정 필요
- [ ] `_wrapLST` 함수의 allowance 로직 검토 및 수정
- [ ] Withdrawal 프로세스 전체 검토
- [ ] 홀수/짝수 패턴 원인 파악

### 2. 디버깅 도구 개발
- [ ] Allowance 상태 추적 스크립트
- [ ] Wrapping/Unwrapping 개별 테스트
- [ ] Transaction revert 원인 상세 분석 도구

### 3. 테스트 개선
- [ ] 더 작은 금액으로 테스트 (0.0001 WKAIA)
- [ ] Wrapping 없이 직접 LST 처리 테스트
- [ ] 각 단계별 상태 로깅 강화

## 💡 권장 사항

1. **즉시 조치 필요**:
   - Wrapping 로직을 임시로 비활성화하고 테스트
   - Allowance 설정을 더 관대하게 변경 (type(uint256).max)
   - Withdrawal 실패 원인 상세 로깅 추가

2. **중기 개선**:
   - 전체 allowance 관리 시스템 재설계
   - Wrapping/Unwrapping 프로세스 단순화
   - 에러 처리 및 복구 메커니즘 강화

3. **장기 전략**:
   - 완전한 통합 테스트 스위트 구축
   - CI/CD 파이프라인에 자동 테스트 통합
   - 메인넷 배포 전 감사 필수

## 📌 중요 참고사항

- **현재 상태**: 프로덕션 배포 불가능
- **영향 범위**: 모든 사용자의 자금 인출 불가
- **위험도**: 매우 높음 (자금 동결 위험)
- **우선순위**: 최고 - 즉시 해결 필요

## 🔗 관련 파일
- 컨트랙트: `src/KommuneVaultV2.sol`, `src/SwapContract.sol`
- 테스트: `scripts/comprehensiveWithdrawTest.js`, `scripts/fullIntegrationTest.js`
- 설정: `hardhat.config.js`, `deployments-kairos.json`

---

**작성일**: 2025-08-13
**작성자**: Claude (KommuneFi 개발 지원)
**다음 세션 예정일**: 내일 (사용자 언급)