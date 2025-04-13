const db = wx.cloud.database({
  env: 'chilling-4gdawl4ea811c0cd' // 你的云环境ID
});
const therapists = db.collection('therapists');

// 获取所有在职理疗师
export function getAllTherapists() {
  return new Promise((resolve, reject) => {
    therapists.where({
      status: 'active'
    })
    .get()
    .then(res => {
      resolve(res.data);
    })
    .catch(err => {
      console.error('获取理疗师失败：', err);
      reject(err);
    });
  });
}

// 根据ID获取理疗师
export function getTherapistById(id) {
  return new Promise((resolve, reject) => {
    therapists.doc(id)
    .get()
    .then(res => {
      resolve(res.data);
    })
    .catch(err => {
      console.error('获取理疗师详情失败：', err);
      reject(err);
    });
  });
}

// 根据专长筛选理疗师
export function getTherapistsBySpecialty(specialty) {
  return new Promise((resolve, reject) => {
    therapists.where({
      status: 'active',
      specialties: db.command.all([specialty])
    })
    .get()
    .then(res => {
      resolve(res.data);
    })
    .catch(err => {
      console.error('获取理疗师失败：', err);
      reject(err);
    });
  });
} 