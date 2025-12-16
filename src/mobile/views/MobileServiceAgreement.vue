<template>
  <MobileLayout :safeAreaTop="true" class="overflow-hidden" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="서비스 약관" />

    <div class="agreement-container">
      <!-- 약관 내용 -->
      <div class="agreement-content">
        <div class="agreement-header">
          <h1>HuLa 서비스 약관</h1>
          <p class="update-time">업데이트 시간: 2025년 9월 3일</p>
        </div>

        <div class="agreement-body">
          <section>
            <h2>1. 서비스 약관의 확인 및 수락</h2>
            <p>
              HuLa 인스턴트 메시징 소프트웨어 사용을 환영합니다! HuLa의 각종 전자 서비스의 소유권 및 운영권은 HuLa에 있습니다. 사용자는 모든 서비스 약관에 완전히 동의하고 등록 절차를 완료해야만 HuLa의 정식 사용자가 될 수 있습니다.
            </p>
          </section>

          <section>
            <h2>2. 서비스 소개</h2>
            <p>
              HuLa는 무료 인스턴트 메시징 소프트웨어로, 사용자는 HuLa를 통해 친구와 문자, 음성, 영상 채팅을 하고 사진, 파일 등을 공유할 수 있습니다. HuLa는 사용자에게 안전하고 안정적이며 편리한 통신 서비스를 제공하기 위해 최선을 다하고 있습니다.
            </p>
          </section>

          <section>
            <h2>3. 사용자 등록</h2>
            <p>3.1 사용자는 등록 시 진실하고 정확하며 완전한 개인 정보를 제공해야 합니다.</p>
            <p>
              3.2
              사용자는 비밀번호와 계정의 보안을 보장할 의무가 있으며, 해당 비밀번호와 계정을 사용하여 수행된 모든 활동으로 인해 발생하는 손실이나 손해에 대해 전적으로 책임을 져야 합니다.
            </p>
            <p>3.3 사용자는 제품 정보, 서비스 정보, 특별 혜택 정보 등을 포함하되 이에 국한되지 않는 HuLa의 정보를 수신하는 데 동의합니다.</p>
          </section>

          <section>
            <h2>4. 사용자 행동 규범</h2>
            <p>4.1 사용자는 HuLa 서비스를 이용할 때 중화인민공화국의 관련 법률 및 규정을 준수해야 합니다.</p>
            <p>4.2 HuLa 서비스를 이용하여 불법 범죄 활동을 하는 것을 금지합니다.</p>
            <p>
              4.3 불법, 유해, 위협, 모욕, 괴롭힘, 침해, 비방, 저속, 외설 또는 기타 도덕적으로 불쾌한 내용을 게시하거나 전파하는 것을 금지합니다.
            </p>
            <p>4.4 타인의 지적 재산권 또는 기타 합법적 권익을 침해하는 내용을 게시하거나 전파하는 것을 금지합니다.</p>
            <p>4.5 바이러스, 트로이 목마 등 악성 프로그램을 악의적으로 전파하는 것을 금지합니다.</p>
          </section>

          <section>
            <h2>5. 개인정보 보호</h2>
            <p>
              5.1
              HuLa는 사용자 개인정보 보호를 매우 중요하게 생각합니다. 법률 및 규정에 달리 명시되지 않는 한, HuLa는 사용자의 동의 없이 제3자에게 사용자 개인정보를 공개하거나 양도하지 않습니다.
            </p>
            <p>5.2 HuLa는 업계 표준 보안 조치를 채택하여 사용자 개인정보를 보호하고 데이터의 무단 액세스, 사용 또는 공개를 방지합니다.</p>
            <p>5.3 사용자는 HuLa가 사용자에게 더 나은 서비스를 제공하기 위해 사용자의 관련 정보를 수집하고 사용할 수 있음을 이해하고 동의합니다.</p>
          </section>

          <section>
            <h2>6. 지적 재산권</h2>
            <p>6.1 HuLa 소프트웨어 및 관련 기술, 상표, 저작권 등 지적 재산권은 모두 HuLa에 귀속됩니다.</p>
            <p>6.2 HuLa의 서면 허가 없이 사용자는 HuLa 소프트웨어를 리버스 엔지니어링, 디스어셈블리, 디컴파일 등을 할 수 없습니다.</p>
            <p>6.3 사용자가 HuLa를 통해 게시한 콘텐츠에 대해 사용자는 지적 재산권을 보유하지만, 동시에 HuLa에게 전 세계적으로 무료, 비독점적 사용 권한을 부여합니다.</p>
          </section>

          <section>
            <h2>7. 면책 조항</h2>
            <p>7.1 사용자는 HuLa 서비스 이용에 따른 위험을 전적으로 자신이 부담한다는 데 명시적으로 동의합니다.</p>
            <p>7.2 HuLa는 서비스가 사용자의 요구 사항을 충족한다고 보장하지 않으며 서비스가 중단되지 않는다고 보장하지도 않습니다.</p>
            <p>7.3 불가항력 또는 HuLa가 통제할 수 없는 원인으로 인한 네트워크 서비스 중단 또는 기타 결함에 대해 HuLa는 어떠한 책임도 지지 않습니다.</p>
          </section>

          <section>
            <h2>8. 서비스 변경, 중단 또는 종료</h2>
            <p>8.1 HuLa는 비즈니스 개발 필요에 따라 서비스의 일부 또는 전부를 변경, 중단 또는 종료할 권리가 있습니다.</p>
            <p>8.2 시스템 유지 관리 또는 업그레이드 필요로 인해 네트워크 서비스를 일시 중단해야 하는 경우, HuLa는 가능한 한 사전에 공지합니다.</p>
            <p>8.3 사용자가 본 약관의 조항을 위반하는 경우, HuLa는 해당 사용자에게 서비스 제공을 종료할 권리가 있습니다.</p>
          </section>

          <section>
            <h2>9. 약관 수정</h2>
            <p>
              HuLa는 언제든지 본 약관의 조항을 수정할 권리가 있으며, 본 약관의 내용이 변경되면 HuLa는 적절한 방식으로 사용자에게 수정 내용을 알립니다. HuLa가 본 약관의 관련 조항을 수정한 것에 동의하지 않는 경우, 사용자는 네트워크 서비스 사용을 중지할 권리가 있습니다. 사용자가 네트워크 서비스를 계속 사용하는 경우, 사용자는 HuLa가 본 약관의 관련 조항을 수정한 것을 수락한 것으로 간주됩니다.
            </p>
          </section>

          <section>
            <h2>10. 법률 적용 및 분쟁 해결</h2>
            <p>10.1 본 약관의 체결, 집행, 해석 및 분쟁 해결은 중화인민공화국 법률을 적용합니다.</p>
            <p>
              10.2
              본 약관의 내용이나 집행과 관련하여 분쟁이 발생하는 경우, 양 당사자는 우호적인 협의를 통해 해결하도록 노력해야 합니다. 협의가 이루어지지 않을 경우, 어느 한 쪽이든 HuLa 소재지 인민법원에 소송을 제기할 수 있습니다.
            </p>
          </section>

          <section>
            <h2>11. 오픈 소스 프로젝트 면책 조항</h2>
            <p>
              본 프로젝트는 오픈 소스 프로젝트로 제공되며, 개발자는 법률이 허용하는 범위 내에서 소프트웨어의 기능성, 보안성 또는 적합성에 대해 어떠한 형태의 명시적 또는 묵시적 보증도 제공하지 않습니다.
            </p>
            <p>
              사용자는 본 소프트웨어 사용에 따른 위험을 전적으로 사용자가 부담하며, 소프트웨어가 "있는 그대로" 및 "사용 가능한" 상태로 제공된다는 것을 명확히 이해하고 동의합니다. 개발자는 상품성, 특정 목적에의 적합성 및 비침해에 대한 보증을 포함하여 명시적이든 묵시적이든 어떠한 형태의 보증도 제공하지 않습니다.
            </p>
            <p>
              어떠한 경우에도 개발자 또는 공급업체는 본 소프트웨어 사용으로 인해 발생하는 이익 손실, 업무 중단, 개인정보 유출 또는 기타 상업적 손해나 손실을 포함하여 직접적, 간접적, 우발적, 특별, 징벌적 또는 결과적 손해에 대해 책임을 지지 않습니다.
            </p>
            <p>본 프로젝트에서 2차 개발을 수행하는 모든 사용자는 본 소프트웨어를 합법적인 목적으로만 사용하고 현지 법률 및 규정을 준수할 책임이 있음을 약속해야 합니다.</p>
            <p>
              개발자는 언제든지 소프트웨어의 기능이나 특성 및 본 면책 조항의 일부를 수정할 권리가 있으며, 이러한 수정 사항은 소프트웨어 업데이트 형태로 반영될 수 있습니다.
            </p>
          </section>

          <section>
            <h2>12. 최종 해석권</h2>
            <p>본 약관의 최종 해석권은 작성자에게 있습니다.</p>
          </section>
        </div>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
.agreement-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  user-select: none;
  -webkit-user-select: none;
}

.agreement-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;

  .agreement-header {
    text-align: center;
    margin-bottom: 30px;

    h1 {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }

    .update-time {
      font-size: 14px;
      color: #666;
    }
  }

  .agreement-body {
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.6;

    section {
      margin-bottom: 25px;

      h2 {
        font-size: 18px;
        font-weight: bold;
        color: #333;
        width: fit-content;
        margin-bottom: 15px;
        border-bottom: 2px solid #13987f90;
        padding-bottom: 5px;
      }

      p {
        font-size: 14px;
        color: #555;
        margin-bottom: 10px;
        text-indent: 2em;
      }
    }
  }
}

/* 스크롤바 스타일 */
.agreement-content::-webkit-scrollbar {
  width: 6px;
}

.agreement-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.agreement-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.agreement-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

:deep(.action-close) {
  svg {
    color: #303030;
  }
}
</style>
