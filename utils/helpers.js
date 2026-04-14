const sendResponse = (res, statusCode, success, message, data = null) => {
    const response = { success, message };
    if (data) response.data = data;
    return res.status(statusCode).json(response);
};

const formatCountdown = (endTimeStr) => {
    const end = new Date(endTimeStr).getTime();
    const now = new Date().getTime();
    const distance = end - now;

    if (distance < 0) return 'Closed';

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

    return `${days}d ${hours}h ${minutes}m left`;
};

module.exports = { sendResponse, formatCountdown };
