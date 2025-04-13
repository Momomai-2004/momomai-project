// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 定义服务数据
    const services = [
      {
        name: "基础拉伸60分钟",
        category: "basic",
        duration: 60,
        price: 299,
        description: "舒缓身体疲劳，放松肌肉",
        status: "active",
        sort: 1
      },
      {
        name: "基础拉伸90分钟",
        category: "basic",
        duration: 90,
        price: 439,
        description: "全身深度放松，缓解压力",
        status: "active",
        sort: 2
      },
      {
        name: "肌肉筋膜处理60分钟",
        category: "advanced",
        duration: 60,
        price: 399,
        description: "针对性缓解肌肉紧张和疼痛",
        status: "active",
        sort: 3
      },
      {
        name: "肌肉筋膜处理90分钟",
        category: "advanced",
        duration: 90,
        price: 579,
        description: "深度肌肉筋膜松解，恢复活力",
        status: "active",
        sort: 4
      }
    ]

    // 直接添加数据
    const addedServices = []
    for (let service of services) {
      const res = await db.collection('services').add({
        data: service
      })
      addedServices.push(res._id)
    }

    return {
      success: true,
      message: '服务数据添加成功',
      addedCount: addedServices.length
    }
  } catch (error) {
    console.error('添加服务失败：', error)
    return {
      success: false,
      error: error.message || error.toString()
    }
  }
}