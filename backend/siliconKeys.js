// backend/siliconKeys.js

let keys = [
    'sk-vzylcltlldynfujkqmndtdrtigfohckdhruqebopggvtuxvu',
    'sk-mbrsrsizgdoatcocukypentanshcvjsrlqytptresrdxzdzb',
    'sk-pwfiyanhbylwuvcpjympjlgzfcctwcdfixqgtybhxmadcizi',
    'sk-qmbyzierimdbinykjkercapmfijmjvxjcuiyrjiulmssbbcx',
    'sk-uxxkswvkxiywsmgbrxtvfbzedbucpzltigrrpolpnkrdytfw',
    'sk-tsswdvkfyikwhkpdwrgxaaetrzbeweygogakdyfummkipzud',
    'sk-unsxjkyrinqppgrfdyrnhwqpnvmlvkwzlxrslkgwohhpiign',
    'sk-tiaehcajypunwxhyaaqcoqukdcsizeuzwfokcwscyedgwoey',
    'sk-niwrjytpfcdxtztnqdcgzjrtkqhorhnzbfrrsmnojccnxlfu'
];

let currentIndex = 0;
let isExhausted = false;
let userKey = null;

module.exports = {
    getKey: () => {
        if (userKey) return userKey;
        if (isExhausted) return null;
        return keys[currentIndex];
    },
    rotateKey: () => {
        if (userKey) {
            console.error("[KeyManager] User provided key also failed.");
            userKey = null;
            isExhausted = true;
            return false;
        }

        if (currentIndex < keys.length - 1) {
            currentIndex++;
            console.log(`[KeyManager] Rotated to SiliconFlow key #${currentIndex + 1}`);
            return true;
        } else {
            console.warn("[KeyManager] ALL SILICONFLOW KEYS EXHAUSTED.");
            isExhausted = true;
            return false;
        }
    },
    setUserKey: (key) => {
        userKey = key;
        isExhausted = false;
        console.log("[KeyManager] User key set and activated.");
    },
    isExhausted: () => isExhausted && !userKey
};
