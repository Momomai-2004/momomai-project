// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const collectionsToCreate = [
    'services',
    'users',
    'orders',
    'appointments',
    'therapists',
    'restTimes',
    'giftRecords',
    'staff',
    'edit_logs',        // 操作日志
    'wallet_records',   // 钱包记录
    'times_records',    // 次数记录
    'transactions'     // 交易记录
  ];
  
  const results = {};
  
  for (const collection of collectionsToCreate) {
    try {
      // 检查集合是否存在
      try {
        await db.collection(collection).limit(1).get();
        results[collection] = { exists: true, message: '集合已存在' };
      } catch (checkErr) {
        // 如果错误码是-502005，则表示集合不存在
        if (checkErr.errCode === -502005) {
          // 集合不存在，创建集合
          try {
            await db.createCollection(collection);
            results[collection] = { created: true, message: '集合创建成功' };
          } catch (createErr) {
            results[collection] = { 
              error: true, 
              message: '创建失败: ' + (createErr.message || createErr),
              errCode: createErr.errCode
            };
          }
        } else {
          results[collection] = { 
            error: true, 
            message: '检查失败: ' + (checkErr.message || checkErr),
            errCode: checkErr.errCode
          };
        }
      }
    } catch (err) {
      results[collection] = { 
        error: true, 
        message: '处理错误: ' + (err.message || err),
        errCode: err.errCode
      };
    }
  }
  
  return {
    success: true,
    results,
    message: '数据库初始化完成'
  };
}; 