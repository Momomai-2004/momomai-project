// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 理疗师数据
    const therapistsData = [
      {
        "_id": "staff001",
        "staff_id": "T001",
        "password": "123456",
        "name": "张教练",
        "gender": "male",
        "avatar": "cloud://云环境ID.云存储ID/staff/avatar1.jpg",
        "phone": "13800000001",
        "specialties": [
          "基础拉伸",
          "肩颈松解",
          "运动恢复"
        ],
        "service_types": [
          {
            "type": "basic_60",
            "name": "基础拉伸60分钟",
            "price": 299
          },
          {
            "type": "basic_90",
            "name": "基础拉伸90分钟",
            "price": 439
          },
          {
            "type": "advanced_60",
            "name": "肌肉筋膜处理60分钟",
            "price": 399
          },
          {
            "type": "advanced_90",
            "name": "肌肉筋膜处理90分钟",
            "price": 579
          }
        ],
        "rating": 4.8,
        "status": "active",
        "is_staff": true,
        "role": "therapist",
        "rest_times": [],
        "create_time": new Date("2023-09-01T10:00:00Z")
      },
      {
        "_id": "staff002",
        "staff_id": "B",
        "password": "123456",
        "name": "B",
        "gender": "female",
        "avatar": "cloud://云环境ID.云存储ID/staff/avatar2.jpg",
        "phone": "13800000002",
        "specialties": [
          "筋膜放松",
          "运动损伤修复",
          "体态调整"
        ],
        "service_types": [
          {
            "type": "basic_60",
            "name": "基础拉伸60分钟",
            "price": 299
          },
          {
            "type": "basic_90",
            "name": "基础拉伸90分钟",
            "price": 439
          },
          {
            "type": "advanced_60",
            "name": "肌肉筋膜处理60分钟",
            "price": 399
          },
          {
            "type": "advanced_90",
            "name": "肌肉筋膜处理90分钟",
            "price": 579
          }
        ],
        "rating": 4.9,
        "status": "active",
        "is_staff": true,
        "role": "therapist",
        "rest_times": [],
        "create_time": new Date("2023-09-01T10:05:00Z")
      },
      {
        "_id": "staff003",
        "staff_id": "C",
        "password": "123456",
        "name": "C",
        "gender": "male",
        "avatar": "cloud://云环境ID.云存储ID/staff/avatar3.jpg",
        "phone": "13800000003",
        "specialties": [
          "体态调整",
          "疼痛处理",
          "运动训练"
        ],
        "service_types": [
          {
            "type": "basic_60",
            "name": "基础拉伸60分钟",
            "price": 299
          },
          {
            "type": "basic_90",
            "name": "基础拉伸90分钟",
            "price": 439
          },
          {
            "type": "advanced_60",
            "name": "肌肉筋膜处理60分钟",
            "price": 399
          },
          {
            "type": "advanced_90",
            "name": "肌肉筋膜处理90分钟",
            "price": 579
          }
        ],
        "rating": 4.7,
        "status": "active",
        "is_staff": true,
        "role": "therapist",
        "rest_times": [],
        "create_time": new Date("2023-09-01T10:10:00Z")
      }
    ]

    // 清空现有数据
    await db.collection('therapists').where({
      _id: _.exists(true)
    }).remove()

    // 批量导入数据
    for (const therapist of therapistsData) {
      await db.collection('therapists').add({
        data: therapist
      })
    }

    return {
      success: true,
      message: '理疗师数据导入成功'
    }
  } catch (error) {
    console.error('导入理疗师数据失败:', error)
    return {
      success: false,
      error
    }
  }
} 