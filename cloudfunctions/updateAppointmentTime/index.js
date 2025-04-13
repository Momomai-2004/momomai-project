// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const appointments = db.collection('appointments');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { appointmentId, newDate, newTime, therapistId, isAdmin, isStaff } = event;
  
  try {
    // 获取预约信息
    const appointmentRes = await appointments.doc(appointmentId).get();
    const appointment = appointmentRes.data;
    
    if (!appointment) {
      return {
        success: false,
        message: '未找到预约信息'
      };
    }
    
    // 权限检查：管理员、员工、预约本人可以修改
    const openid = wxContext.OPENID;
    let hasPermission = false;
    
    // 管理员和员工可以修改任何预约
    if (isAdmin || isStaff) {
      hasPermission = true;
    } else {
      // 检查是否是预约本人
      const userRes = await db.collection('users').where({
        _openid: openid
      }).get();
      
      if (userRes.data.length > 0 && userRes.data[0]._id === appointment.user_id) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return {
        success: false,
        message: '没有权限修改此预约'
      };
    }
    
    // 获取技师信息
    let therapistName = '';
    if (therapistId) {
      const therapistRes = await db.collection('therapists').doc(therapistId).get();
      if (therapistRes.data) {
        therapistName = therapistRes.data.name || '';
      }
    }
    
    // 检查新时间是否已被预约
    const timeCheckRes = await db.collection('appointments').where({
      appointment_date: newDate,
      time_slot: newTime,
      therapist_id: therapistId,
      _id: db.command.neq(appointmentId),
      status: db.command.in(['pending', 'confirmed'])
    }).count();
    
    if (timeCheckRes.total > 0) {
      return {
        success: false,
        message: '该时间段已被预约'
      };
    }
    
    // 获取操作人信息
    let operatorName = '系统';
    let operatorId = '';
    
    if (isAdmin) {
      operatorName = '管理员';
      // 尝试获取管理员信息
      const adminRes = await db.collection('users').where({
        userType: 'admin',
        _openid: openid
      }).get();
      
      if (adminRes.data.length > 0) {
        operatorId = adminRes.data[0]._id;
        operatorName = adminRes.data[0].nickName || '管理员';
      }
    } else if (isStaff) {
      // 尝试获取员工信息
      const staffRes = await db.collection('users').where({
        is_staff: true,
        _openid: openid
      }).get();
      
      if (staffRes.data.length > 0) {
        operatorId = staffRes.data[0]._id;
        operatorName = staffRes.data[0].nickName || '员工';
      } else {
        operatorName = '员工';
      }
    } else {
      // 普通用户
      const userRes = await db.collection('users').where({
        _openid: openid
      }).get();
      
      if (userRes.data.length > 0) {
        operatorId = userRes.data[0]._id;
        operatorName = userRes.data[0].nickName || '用户';
      } else {
        operatorName = '用户';
      }
    }
    
    // 更新预约信息
    await appointments.doc(appointmentId).update({
      data: {
        appointment_date: newDate,
        time_slot: newTime,
        therapist_id: therapistId,
        therapist_name: therapistName,
        update_time: db.serverDate(),
        updated_by: operatorId,
        updated_by_name: operatorName
      }
    });
    
    // 记录修改历史
    await db.collection('appointment_changes').add({
      data: {
        appointment_id: appointmentId,
        old_date: appointment.appointment_date,
        old_time: appointment.time_slot,
        old_therapist_id: appointment.therapist_id || '',
        old_therapist_name: appointment.therapist_name || '',
        new_date: newDate,
        new_time: newTime,
        new_therapist_id: therapistId,
        new_therapist_name: therapistName,
        change_time: db.serverDate(),
        changed_by: operatorId,
        changed_by_name: operatorName,
        reason: isAdmin ? '管理员修改预约' : (isStaff ? '员工修改预约' : '用户修改预约')
      }
    });
    
    return {
      success: true,
      message: '预约时间已更新'
    };
  } catch (error) {
    console.error('更新预约时间失败:', error);
    return {
      success: false,
      message: '更新预约时间失败',
      error: error
    };
  }
}; 