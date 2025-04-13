// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始执行添加服务函数...');
    
    // 检查集合是否存在
    try {
      await db.createCollection('services');
      console.log('创建services集合成功');
    } catch (e) {
      console.log('services集合已存在或创建失败:', e);
    }
    
    // 先清空现有服务
    try {
      const countResult = await db.collection('services').count();
      if (countResult.total > 0) {
        console.log(`检测到${countResult.total}条现有服务记录，准备清空...`);
        const oldRecords = await db.collection('services').get();
        
        for (const record of oldRecords.data) {
          await db.collection('services').doc(record._id).remove();
        }
        console.log('成功清空现有服务记录');
      }
    } catch (err) {
      console.error('清空现有服务记录失败:', err);
    }
    
    // 定义服务数据
    const services = [
      {
        name: "基础拉伸60分钟",
        category: "basic",
        duration: 60,
        price: 299,
        description: "日常保健",
        status: "active",
        sort: 1,
        display_name: "基础拉伸60分钟",
        service_id: "basic_60"
      },
      {
        name: "基础拉伸90分钟",
        category: "basic",
        duration: 90,
        price: 439,
        description: "日常保健",
        status: "active",
        sort: 2,
        display_name: "基础拉伸90分钟",
        service_id: "basic_90"
      },
      {
        name: "肌肉筋膜处理60分钟",
        category: "advanced",
        duration: 60,
        price: 399,
        description: "综合解决：体态调整，损伤修护，疼痛处理",
        status: "active",
        sort: 3,
        display_name: "肌肉筋膜处理60分钟",
        service_id: "advanced_60"
      },
      {
        name: "肌肉筋膜处理90分钟",
        category: "advanced",
        duration: 90,
        price: 579,
        description: "综合解决：体态调整，损伤修护，疼痛处理",
        status: "active",
        sort: 4,
        display_name: "肌肉筋膜处理90分钟",
        service_id: "advanced_90"
      }
    ];

    console.log('准备添加服务数据...');
    
    // 直接添加数据
    const addedServices = [];
    for (let i = 0; i < services.length; i++) {
      try {
        console.log(`添加第${i+1}个服务: ${services[i].name}`);
        const res = await db.collection('services').add({
          data: services[i]
        });
        console.log(`添加成功，ID: ${res._id}`);
        addedServices.push(res._id);
      } catch (err) {
        console.error(`添加第${i+1}个服务失败:`, err);
        throw err; // 重新抛出错误以便被外层catch捕获
      }
    }

    console.log(`成功添加了${addedServices.length}个服务`);
    
    // 验证数据
    const checkRes = await db.collection('services').get();
    console.log('当前服务数据:', checkRes.data);

    return {
      success: true,
      message: '服务数据添加成功',
      addedCount: addedServices.length,
      addedIds: addedServices,
      currentData: checkRes.data
    };
  } catch (error) {
    console.error('添加服务失败:', error);
    return {
      success: false,
      message: '添加服务失败',
      error: error.message || error.toString()
    };
  }
};