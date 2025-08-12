const { ethers } = require("hardhat");
const { testSuite } = require("./testSuite");
const { advancedTestSuite } = require("./advancedTestSuite");
const { edgeCaseTestSuite } = require("./edgeCaseTestSuite");
const { performanceTestSuite } = require("./performanceTestSuite");

/**
 * 통합 테스트 실행기: 모든 테스트 스위트를 순차적으로 실행
 * - 기본 테스트 → 고급 테스트 → Edge Case → 성능 테스트 순으로 실행
 * - 각 단계별 결과 요약 및 전체 리포트 생성
 */

async function runAllTests() {
  console.log("🚀 KommuneFi Vault 전체 테스트 스위트 실행");
  console.log("=" .repeat(80));
  
  const startTime = Date.now();
  const overallResults = {
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    testSuites: [],
    summary: {
      totalTests: 0,
      totalPassed: 0,
      overallSuccess: false,
      duration: 0
    }
  };
  
  // 1. 기본 테스트 스위트
  console.log("📝 1단계: 기본 기능 테스트");
  console.log("-".repeat(40));
  
  try {
    const basicResults = await testSuite();
    overallResults.testSuites.push({
      name: "기본 테스트",
      passed: basicResults.passedTests,
      total: basicResults.totalTests,
      success: basicResults.passedTests === basicResults.totalTests,
      results: basicResults.results
    });
    
    console.log(`✅ 기본 테스트 완료: ${basicResults.passedTests}/${basicResults.totalTests}`);
    
    // 기본 테스트가 실패하면 중단할지 결정
    if (basicResults.passedTests < basicResults.totalTests * 0.8) {
      console.log("⚠️  기본 테스트 실패율이 높습니다. 고급 테스트를 건너뜁니다.");
      overallResults.summary.totalTests = basicResults.totalTests;
      overallResults.summary.totalPassed = basicResults.passedTests;
      overallResults.summary.duration = Date.now() - startTime;
      return overallResults;
    }
  } catch (error) {
    console.log(`❌ 기본 테스트 실행 실패: ${error.message}`);
    overallResults.testSuites.push({
      name: "기본 테스트",
      passed: 0,
      total: 1,
      success: false,
      error: error.message
    });
  }
  
  console.log();
  
  // 2. 고급 테스트 스위트
  console.log("🔬 2단계: 고급 기능 테스트");
  console.log("-".repeat(40));
  
  try {
    const advancedResults = await advancedTestSuite();
    overallResults.testSuites.push({
      name: "고급 테스트",
      passed: advancedResults.passedTests,
      total: advancedResults.totalTests,
      success: advancedResults.passedTests === advancedResults.totalTests,
      results: advancedResults.results,
      gasMetrics: advancedResults.gasMetrics
    });
    
    console.log(`✅ 고급 테스트 완료: ${advancedResults.passedTests}/${advancedResults.totalTests}`);
  } catch (error) {
    console.log(`❌ 고급 테스트 실행 실패: ${error.message}`);
    overallResults.testSuites.push({
      name: "고급 테스트",
      passed: 0,
      total: 1,
      success: false,
      error: error.message
    });
  }
  
  console.log();
  
  // 3. Edge Case 테스트 스위트
  console.log("🧪 3단계: Edge Case 테스트");
  console.log("-".repeat(40));
  
  try {
    const edgeCaseResults = await edgeCaseTestSuite();
    overallResults.testSuites.push({
      name: "Edge Case 테스트",
      passed: edgeCaseResults.passedTests,
      total: edgeCaseResults.totalTests,
      success: edgeCaseResults.passedTests === edgeCaseResults.totalTests,
      results: edgeCaseResults.results,
      criticalIssues: edgeCaseResults.criticalIssues
    });
    
    console.log(`✅ Edge Case 테스트 완료: ${edgeCaseResults.passedTests}/${edgeCaseResults.totalTests}`);
  } catch (error) {
    console.log(`❌ Edge Case 테스트 실행 실패: ${error.message}`);
    overallResults.testSuites.push({
      name: "Edge Case 테스트",
      passed: 0,
      total: 1,
      success: false,
      error: error.message
    });
  }
  
  console.log();
  
  // 4. 성능 테스트 스위트
  console.log("⚡ 4단계: 성능 테스트");
  console.log("-".repeat(40));
  
  try {
    const performanceResults = await performanceTestSuite();
    overallResults.testSuites.push({
      name: "성능 테스트",
      passed: performanceResults.passedTests,
      total: performanceResults.totalTests,
      success: performanceResults.passedTests === performanceResults.totalTests,
      performanceData: performanceResults.performanceData
    });
    
    console.log(`✅ 성능 테스트 완료: ${performanceResults.passedTests}/${performanceResults.totalTests}`);
  } catch (error) {
    console.log(`❌ 성능 테스트 실행 실패: ${error.message}`);
    overallResults.testSuites.push({
      name: "성능 테스트",
      passed: 0,
      total: 1,
      success: false,
      error: error.message
    });
  }
  
  // 전체 결과 요약
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  overallResults.summary.totalTests = overallResults.testSuites.reduce((sum, suite) => sum + suite.total, 0);
  overallResults.summary.totalPassed = overallResults.testSuites.reduce((sum, suite) => sum + suite.passed, 0);
  overallResults.summary.duration = totalDuration;
  overallResults.summary.overallSuccess = overallResults.summary.totalPassed === overallResults.summary.totalTests;
  
  console.log();
  console.log("=" .repeat(80));
  console.log("📊 전체 테스트 결과 요약");
  console.log("=" .repeat(80));
  
  // 스위트별 결과
  console.log("🏆 테스트 스위트별 결과:");
  for (const suite of overallResults.testSuites) {
    const status = suite.success ? "✅" : "❌";
    const percentage = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(1) : "0.0";
    console.log(`   ${status} ${suite.name}: ${suite.passed}/${suite.total} (${percentage}%)`);
    
    if (suite.error) {
      console.log(`      오류: ${suite.error}`);
    }
  }
  
  console.log();
  
  // 전체 통계
  const overallPercentage = overallResults.summary.totalTests > 0 ? 
    ((overallResults.summary.totalPassed / overallResults.summary.totalTests) * 100).toFixed(1) : "0.0";
    
  console.log("📈 전체 통계:");
  console.log(`   총 테스트: ${overallResults.summary.totalTests}`);
  console.log(`   성공: ${overallResults.summary.totalPassed}`);
  console.log(`   실패: ${overallResults.summary.totalTests - overallResults.summary.totalPassed}`);
  console.log(`   성공률: ${overallPercentage}%`);
  console.log(`   실행 시간: ${(totalDuration / 1000).toFixed(1)}초`);
  
  console.log();
  
  // 최종 평가
  if (overallResults.summary.overallSuccess) {
    console.log("🎉 모든 테스트 통과! 시스템이 완벽하게 작동합니다.");
  } else if (parseFloat(overallPercentage) >= 90) {
    console.log("✅ 대부분의 테스트 통과! 시스템이 안정적으로 작동합니다.");
  } else if (parseFloat(overallPercentage) >= 70) {
    console.log("⚠️  일부 문제가 발견되었습니다. 추가 개선이 필요합니다.");
  } else {
    console.log("❌ 심각한 문제가 발견되었습니다. 시스템 점검이 필요합니다.");
  }
  
  // 주요 이슈 식별
  console.log();
  console.log("🔍 주요 발견사항:");
  
  let criticalIssues = [];
  for (const suite of overallResults.testSuites) {
    if (suite.criticalIssues && suite.criticalIssues.length > 0) {
      criticalIssues = criticalIssues.concat(suite.criticalIssues);
    }
  }
  
  if (criticalIssues.length > 0) {
    console.log("   🚨 중요한 이슈:");
    for (const issue of criticalIssues.slice(0, 5)) { // 최대 5개만 표시
      console.log(`      • ${issue.name}: ${issue.message}`);
    }
  }
  
  // 권장 조치사항
  console.log();
  console.log("💡 권장 조치사항:");
  
  const basicSuite = overallResults.testSuites.find(s => s.name === "기본 테스트");
  if (basicSuite && !basicSuite.success) {
    console.log("   1. 기본 기능부터 수정하세요 (deposit/withdraw 메커니즘)");
  }
  
  const edgeCaseSuite = overallResults.testSuites.find(s => s.name === "Edge Case 테스트");
  if (edgeCaseSuite && edgeCaseSuite.criticalIssues && edgeCaseSuite.criticalIssues.length > 0) {
    console.log("   2. 보안 및 경계 조건 처리를 강화하세요");
  }
  
  const performanceSuite = overallResults.testSuites.find(s => s.name === "성능 테스트");
  if (performanceSuite && performanceSuite.passed < performanceSuite.total * 0.8) {
    console.log("   3. 가스 사용량 최적화를 검토하세요");
  }
  
  // 결과를 파일로 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `test-report-${timestamp}.json`;
  
  try {
    const fs = require("fs");
    fs.writeFileSync(reportFile, JSON.stringify(overallResults, null, 2));
    console.log();
    console.log(`📁 상세 리포트 저장됨: ${reportFile}`);
  } catch (error) {
    console.log(`⚠️  리포트 저장 실패: ${error.message}`);
  }
  
  console.log();
  console.log("✨ 테스트 실행 완료");
  console.log("=" .repeat(80));
  
  return overallResults;
}

// 스크립트 직접 실행시
if (require.main === module) {
  runAllTests()
    .then((results) => {
      const exitCode = results.summary.overallSuccess ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error("전체 테스트 실행 중 오류:", error);
      process.exit(1);
    });
}

module.exports = { runAllTests };