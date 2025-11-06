/**
 * 사용자 정보에 대한 인터페이스
 */
interface User {
  id: number;
  name: string;
  items: string[];
}

/**
 * 사용자 ID를 기반으로 사용자 데이터를 조회합니다.
 * (현재는 ID가 1인 경우에만 목 데이터를 반환합니다)
 * @param userId - 조회할 사용자의 숫자 ID
 * @returns {User | null} 사용자를 찾으면 User 객체를, 그렇지 않으면 null을 반환합니다.
 */
//WARN - `export`된 함수는 이름 변경이 되면 안됨!
export function getUserData(userId: number): User | null {
  // 실제 애플리케이션에서는 이 부분에서 API 호출이나 데이터베이스 조회가 이루어집니다.
  try {
    if (userId === 1) {
      const userData: User = { id: userId, name: 'John Doe', items: ['book', 'pen'] };
      return userData;
    }
    return null; // 해당 ID의 사용자가 없을 경우 null 반환
  } catch (error) {
    console.error(`Error fetching data for user ${userId}:`, error);
    // 에러 발생 시에도 null을 반환하여 함수 호출 측에서 일관되게 처리하도록 함
    return null;
  }
}

/**
 * 특정 사용자의 정보를 콘솔에 출력합니다.
 * @param userId - 정보를 출력할 사용자의 ID
 */
const displayUserInfo = (userId: number): void => {
  const user = getUserData(userId);

  if (user) {
    // 템플릿 리터럴(Template literals)을 사용하여 문자열을 명확하게 구성
    console.log(`User found: ${user.name}`);
    // for...of 루프를 사용하여 가독성 향상
    for (const item of user.items) {
      console.log(` - ${item}`);
    }
  } else {
    console.log(`User with ID ${userId} not found.`);
  }
};

// 함수 사용 예시
displayUserInfo(1);