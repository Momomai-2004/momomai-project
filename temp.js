Page({
  viewAppointmentDetail: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    
    // 格式化预约详情
    const detail = {
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: `${appointment.startTime} - ${appointment.endTime}`,
      status: this.data.statusTexts[appointment.status],
      price: appointment.price,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      therapistName: appointment.therapistName || '未分配',
      therapistTitle: appointment.therapistTitle || '',
      notes: appointment.notes || '无',
      createdAt: appointment.createdAt || '未知',
      updatedAt: appointment.updatedAt || '未知'
    };
    
    // 构建详情显示内容
    let content = `服务: ${detail.serviceName}\n`;
});
