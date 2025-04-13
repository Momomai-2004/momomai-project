// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'chilling-4gdawl4ea811c0cd' // 替换为你的云环境ID
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取理疗师列表
    const therapistsRes = await db.collection('therapists')
      .where({
        status: 'active' // 只获取有效的理疗师
      })
      .get()
    
    return {
      success: true,
      data: therapistsRes.data
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
}