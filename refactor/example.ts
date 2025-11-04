// 사용자 정보를 가져와서 처리하는 오래된 스타일의 코드
//WARN - `export`된 함수는 이름 변경이 되면 안됨!
export function getUserData(userId) {
    var data = { id: userId, name: 'John Doe', items: ['book', 'pen'] };
    if (userId == 1) {
        return data;
    } else {
        return null;
    }
}

function processUser(id) {
    var user = getUserData(id);
    if (user) {
        console.log("User found: " + user.name);
        for(var i = 0; i < user.items.length; i++) {
            console.log(" - " + user.items[i]);
        }
    } else {
        console.log("User not found.");
    }
}

processUser(1);
