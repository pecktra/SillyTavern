import {getRequestHeaders, getUid} from '../script.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from './popup.js';
import { renderTemplateAsync } from './templates.js';
import { ensureImageFormatSupported, getBase64Async, humanFileSize } from './utils.js';
import axios from "https://cdn.jsdelivr.net/npm/axios/dist/esm/axios.min.js"

/**
 * @type {import('../../src/users.js').UserViewModel} Logged in user
 */
export let currentUser = null;
export let accountsEnabled = false;

// Extend the session every 10 minutes
const SESSION_EXTEND_INTERVAL = 10 * 60 * 1000;

/**
 * Enable or disable user account controls in the UI.
 * @param {boolean} isEnabled User account controls enabled
 * @returns {Promise<void>}
 */
export async function setUserControls(isEnabled) {
    accountsEnabled = isEnabled;

    if (!isEnabled) {
        $('#logout_button').hide();
        $('#admin_button').hide();
        return;
    }

    $('#logout_button').show();
    await getCurrentUser();
}

/**
 * Check if the current user is an admin.
 * @returns {boolean} True if the current user is an admin
 */
export function isAdmin() {
    if (!accountsEnabled) {
        return true;
    }

    if (!currentUser) {
        return false;
    }

    return Boolean(currentUser.admin);
}

/**
 * Gets the handle string of the current user.
 * @returns {string} User handle
 */
export function getCurrentUserHandle() {
    return currentUser?.handle || 'default-user';
}

/**
 * Get the current user.
 * @returns {Promise<void>}
 */
async function getCurrentUser() {
    try {
        const response = await fetch('/api/users/me', {
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to get current user');
        }

        currentUser = await response.json();
        $('#admin_button').toggle(accountsEnabled && isAdmin());
    } catch (error) {
        console.error('Error getting current user:', error);
    }
}

/**
 * Get a list of all users.
 * @returns {Promise<import('../../src/users.js').UserViewModel[]>} Users
 */
async function getUsers() {
    try {
        const response = await fetch('/api/users/get', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to get users');
        }

        return response.json();
    } catch (error) {
        console.error('Error getting users:', error);
    }
}

/**
 * Enable a user account.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function enableUser(handle, callback) {
    try {
        const response = await fetch('/api/users/enable', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to enable user');
            throw new Error('Failed to enable user');
        }

        callback();
    } catch (error) {
        console.error('Error enabling user:', error);
    }
}

async function disableUser(handle, callback) {
    try {
        const response = await fetch('/api/users/disable', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data?.error || 'Unknown error', 'Failed to disable user');
            throw new Error('Failed to disable user');
        }

        callback();
    } catch (error) {
        console.error('Error disabling user:', error);
    }
}

/**
 * Promote a user to admin.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function promoteUser(handle, callback) {
    try {
        const response = await fetch('/api/users/promote', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to promote user');
            throw new Error('Failed to promote user');
        }

        callback();
    } catch (error) {
        console.error('Error promoting user:', error);
    }
}

/**
 * Demote a user from admin.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function demoteUser(handle, callback) {
    try {
        const response = await fetch('/api/users/demote', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to demote user');
            throw new Error('Failed to demote user');
        }

        callback();
    } catch (error) {
        console.error('Error demoting user:', error);
    }
}

/**
 * Create a new user.
 * @param {HTMLFormElement} form Form element
 */
async function createUser(form, callback) {
    const errors = [];
    const formData = new FormData(form);

    if (!formData.get('handle')) {
        errors.push('Handle is required');
    }

    if (formData.get('password') !== formData.get('confirm')) {
        errors.push('Passwords do not match');
    }

    if (errors.length) {
        toastr.error(errors.join(', '), 'Failed to create user');
        return;
    }

    const body = {};
    formData.forEach(function (value, key) {
        if (key === 'confirm') {
            return;
        }
        if (key.startsWith('_')) {
            key = key.substring(1);
        }
        body[key] = value;

    });

    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to create user');
            throw new Error('Failed to create user');
        }

        form.reset();
        callback();
    } catch (error) {
        console.error('Error creating user:', error);
    }
}

/**
 * Backup a user's data.
 * @param {string} handle Handle of the user to backup
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function backupUserData(handle, callback) {
    try {
        toastr.info('Please wait for the download to start.', 'Backup Requested');
        const response = await fetch('/api/users/backup', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to backup user data');
            throw new Error('Failed to backup user data');
        }

        const blob = await response.blob();
        const header = response.headers.get('Content-Disposition');
        const parts = header.split(';');
        const filename = parts[1].split('=')[1].replaceAll('"', '');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        callback();
    } catch (error) {
        console.error('Error backing up user data:', error);
    }
}

/**
 * Shows a popup to change a user's password.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function changePassword(handle, callback) {
    try {
        const template = $(await renderTemplateAsync('changePassword'));
        template.find('.currentPasswordBlock').toggle(!isAdmin());
        let newPassword = '';
        let confirmPassword = '';
        let oldPassword = '';
        template.find('input[name="current"]').on('input', function () {
            oldPassword = String($(this).val());
        });
        template.find('input[name="password"]').on('input', function () {
            newPassword = String($(this).val());
        });
        template.find('input[name="confirm"]').on('input', function () {
            confirmPassword = String($(this).val());
        });
        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Change', cancelButton: 'Cancel', wide: false, large: false });
        if (result === POPUP_RESULT.CANCELLED || result === POPUP_RESULT.NEGATIVE) {
            throw new Error('Change password cancelled');
        }

        if (newPassword !== confirmPassword) {
            toastr.error('Passwords do not match', 'Failed to change password');
            throw new Error('Passwords do not match');
        }

        const response = await fetch('/api/users/change-password', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, newPassword, oldPassword }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to change password');
            throw new Error('Failed to change password');
        }

        toastr.success('Password changed successfully', 'Password Changed');
        callback();
    }
    catch (error) {
        console.error('Error changing password:', error);
    }
}

/**
 * Delete a user.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function deleteUser(handle, callback) {
    try {
        if (handle === currentUser.handle) {
            toastr.error('Cannot delete yourself', 'Failed to delete user');
            throw new Error('Cannot delete yourself');
        }

        let purge = false;
        let confirmHandle = '';

        const template = $(await renderTemplateAsync('deleteUser'));
        template.find('#deleteUserName').text(handle);
        template.find('input[name="deleteUserData"]').on('input', function () {
            purge = $(this).is(':checked');
        });
        template.find('input[name="deleteUserHandle"]').on('input', function () {
            confirmHandle = String($(this).val());
        });

        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Delete', cancelButton: 'Cancel', wide: false, large: false });

        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Delete user cancelled');
        }

        if (handle !== confirmHandle) {
            toastr.error('Handles do not match', 'Failed to delete user');
            throw new Error('Handles do not match');
        }

        const response = await fetch('/api/users/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, purge }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to delete user');
            throw new Error('Failed to delete user');
        }

        toastr.success('User deleted successfully', 'User Deleted');
        callback();
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

/**
 * Reset a user's settings.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function resetSettings(handle, callback) {
    try {
        let password = '';
        const template = $(await renderTemplateAsync('resetSettings'));
        template.find('input[name="password"]').on('input', function () {
            password = String($(this).val());
        });
        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Reset', cancelButton: 'Cancel', wide: false, large: false });

        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Reset settings cancelled');
        }

        const response = await fetch('/api/users/reset-settings', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, password }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to reset settings');
            throw new Error('Failed to reset settings');
        }

        toastr.success('Settings reset successfully', 'Settings Reset');
        callback();
    } catch (error) {
        console.error('Error resetting settings:', error);
    }
}

/**
 * Change a user's display name.
 * @param {string} handle User handle
 * @param {string} name Current name
 * @param {function} callback Success callback
 */
async function changeName(handle, name, callback) {
    try {
        const template = $(await renderTemplateAsync('changeName'));
        const result = await callGenericPopup(template, POPUP_TYPE.INPUT, name, { okButton: 'Change', cancelButton: 'Cancel', wide: false, large: false });

        if (!result) {
            throw new Error('Change name cancelled');
        }

        name = String(result);

        const response = await fetch('/api/users/change-name', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, name }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to change name');
            throw new Error('Failed to change name');
        }

        toastr.success('Name changed successfully', 'Name Changed');
        callback();

    } catch (error) {
        console.error('Error changing name:', error);
    }
}

/**
 * Restore a settings snapshot.
 * @param {string} name Snapshot name
 * @param {function} callback Success callback
 */
async function restoreSnapshot(name, callback) {
    try {
        const confirm = await callGenericPopup(
            `Are you sure you want to restore the settings from "${name}"?`,
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: 'Restore', cancelButton: 'Cancel', wide: false, large: false },
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Restore snapshot cancelled');
        }

        const response = await fetch('/api/settings/restore-snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to restore snapshot');
            throw new Error('Failed to restore snapshot');
        }

        callback();
    } catch (error) {
        console.error('Error restoring snapshot:', error);
    }

}

/**
 * Load the content of a settings snapshot.
 * @param {string} name Snapshot name
 * @returns {Promise<string>} Snapshot content
 */
async function loadSnapshotContent(name) {
    try {
        const response = await fetch('/api/settings/load-snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to load snapshot content');
            throw new Error('Failed to load snapshot content');
        }

        return response.text();
    } catch (error) {
        console.error('Error loading snapshot content:', error);
    }
}

/**
 * Gets a list of settings snapshots.
 * @returns {Promise<Snapshot[]>} List of snapshots
 * @typedef {Object} Snapshot
 * @property {string} name Snapshot name
 * @property {number} date Date in milliseconds
 * @property {number} size File size in bytes
 */
async function getSnapshots() {
    try {
        const response = await fetch('/api/settings/get-snapshots', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to get settings snapshots');
            throw new Error('Failed to get settings snapshots');
        }

        const snapshots = await response.json();
        return snapshots;
    } catch (error) {
        console.error('Error getting settings snapshots:', error);
        return [];
    }
}

/**
 * Make a snapshot of the current settings.
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function makeSnapshot(callback) {
    try {
        const response = await fetch('/api/settings/make-snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to make snapshot');
            throw new Error('Failed to make snapshot');
        }

        toastr.success('Snapshot created successfully', 'Snapshot Created');
        callback();
    } catch (error) {
        console.error('Error making snapshot:', error);
    }
}

/**
 * Open the settings snapshots view.
 */
async function viewSettingsSnapshots() {
    const template = $(await renderTemplateAsync('snapshotsView'));
    async function renderSnapshots() {
        const snapshots = await getSnapshots();
        template.find('.snapshotList').empty();

        for (const snapshot of snapshots.sort((a, b) => b.date - a.date)) {
            const snapshotBlock = template.find('.snapshotTemplate .snapshot').clone();
            snapshotBlock.find('.snapshotName').text(snapshot.name);
            snapshotBlock.find('.snapshotDate').text(new Date(snapshot.date).toLocaleString());
            snapshotBlock.find('.snapshotSize').text(humanFileSize(snapshot.size));
            snapshotBlock.find('.snapshotRestoreButton').on('click', async (e) => {
                e.stopPropagation();
                restoreSnapshot(snapshot.name, () => location.reload());
            });
            snapshotBlock.find('.inline-drawer-toggle').on('click', async () => {
                const contentBlock = snapshotBlock.find('.snapshotContent');
                if (!contentBlock.val()) {
                    const content = await loadSnapshotContent(snapshot.name);
                    contentBlock.val(content);
                }

            });
            template.find('.snapshotList').append(snapshotBlock);
        }
    }

    callGenericPopup(template, POPUP_TYPE.TEXT, '', { okButton: 'Close', wide: false, large: false, allowVerticalScrolling: true });
    template.find('.makeSnapshotButton').on('click', () => makeSnapshot(renderSnapshots));
    renderSnapshots();
}

/**
 * Reset everything to default.
 * @param {function} callback Success callback
 */
async function resetEverything(callback) {
    try {
        const step1Response = await fetch('/api/users/reset-step1', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!step1Response.ok) {
            const data = await step1Response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to reset');
            throw new Error('Failed to reset everything');
        }

        let password = '';
        let code = '';

        const template = $(await renderTemplateAsync('userReset'));
        template.find('input[name="password"]').on('input', function () {
            password = String($(this).val());
        });
        template.find('input[name="code"]').on('input', function () {
            code = String($(this).val());
        });
        const confirm = await callGenericPopup(
            template,
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: 'Reset', cancelButton: 'Cancel', wide: false, large: false },
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Reset everything cancelled');
        }

        const step2Response = await fetch('/api/users/reset-step2', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ password, code }),
        });

        if (!step2Response.ok) {
            const data = await step2Response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to reset');
            throw new Error('Failed to reset everything');
        }

        toastr.success('Everything reset successfully', 'Reset Everything');
        callback();
    } catch (error) {
        console.error('Error resetting everything:', error);
    }

}

async function openUserProfile() {
    await getCurrentUser();
    const template = $(await renderTemplateAsync('userProfile'));
    template.find('.userName').text(currentUser.name);
    template.find('.userHandle').text(currentUser.handle);
    template.find('.avatar img').attr('src', currentUser.avatar);
    template.find('.userRole').text(currentUser.admin ? 'Admin' : 'User');
    template.find('.userCreated').text(new Date(currentUser.created).toLocaleString());
    template.find('.hasPassword').toggle(currentUser.password);
    template.find('.noPassword').toggle(!currentUser.password);
    template.find('.userSettingsSnapshotsButton').on('click', () => viewSettingsSnapshots());
    template.find('.userChangeNameButton').on('click', async () => changeName(currentUser.handle, currentUser.name, async () => {
        await getCurrentUser();
        template.find('.userName').text(currentUser.name);
    }));
    template.find('.userChangePasswordButton').on('click', () => changePassword(currentUser.handle, async () => {
        await getCurrentUser();
        template.find('.hasPassword').toggle(currentUser.password);
        template.find('.noPassword').toggle(!currentUser.password);
    }));
    template.find('.userBackupButton').on('click', function () {
        $(this).addClass('disabled');
        backupUserData(currentUser.handle, () => {
            $(this).removeClass('disabled');
        });
    });
    template.find('.userResetSettingsButton').on('click', () => resetSettings(currentUser.handle, () => location.reload()));
    template.find('.userResetAllButton').on('click', () => resetEverything(() => location.reload()));
    template.find('.userAvatarChange').on('click', () => template.find('.avatarUpload').trigger('click'));
    template.find('.avatarUpload').on('change', async function () {
        if (!(this instanceof HTMLInputElement)) {
            return;
        }

        const file = this.files[0];
        if (!file) {
            return;
        }

        await cropAndUploadAvatar(currentUser.handle, file);
        await getCurrentUser();
        template.find('.avatar img').attr('src', currentUser.avatar);
    });
    template.find('.userAvatarRemove').on('click', async function () {
        await changeAvatar(currentUser.handle, '');
        await getCurrentUser();
        template.find('.avatar img').attr('src', currentUser.avatar);
    });

    if (!accountsEnabled) {
        template.find('[data-require-accounts]').hide();
        template.find('.accountsDisabledHint').show();
    }

    const popupOptions = {
        okButton: 'Close',
        wide: false,
        large: false,
        allowVerticalScrolling: true,
        allowHorizontalScrolling: false,
    };
    callGenericPopup(template, POPUP_TYPE.TEXT, '', popupOptions);
}

// 修改 livePlayPanel 函数
async function livePlayPanel() {
    await getCurrentUser();
    if (!currentUser) {
        toastr.error('请先登录');
        return;
    }

    try {
        // 获取直播状态数据
        const response = await axios.get('http://43.162.120.233:8000/api/live/get_live_status', {
            params: {
                uid: getUid(),
                username: currentUser.name
            },
            timeout: 5000,
            headers: {'Content-Type': 'application/json'}
        });

        if (response.data.code !== 0) {
            toastr.error('获取直播状态失败');
            return;
        }

        const liveStatus = response.data.data.live_status;
        const liveListTemplate = $('<div class="liveManagement"></div>');

        // 添加标题
        liveListTemplate.append('<h3 style="text-align: center; margin-bottom: 20px;">角色直播管理</h3>');

        // 创建带滚动条的容器
        const scrollContainer = $('<div style="max-height: 500px; overflow-y: auto; margin-bottom: 15px;"></div>');

        // 创建表格
        const table = $('<table class="liveTable" style="width: 100%; border-collapse: collapse;"></table>');
        table.append('<thead><tr><th style="position: sticky; top: 0; padding: 12px; background: #2c3e50; color: white; z-index: 10;">角色名称</th><th style="position: sticky; top: 0; padding: 12px; background: #2c3e50; color: white; z-index: 10;">直播状态</th><th style="position: sticky; top: 0; padding: 12px; background: #2c3e50; color: white; z-index: 10;">操作</th></tr></thead>');

        const tbody = $('<tbody></tbody>');

        // 填充直播状态数据
        liveStatus.forEach(item => {
            const row = $('<tr style="border-bottom: 1px solid #ddd;"></tr>');
            row.append(`<td style="padding: 12px;">${item.character_name}</td>`);

            const statusCell = $('<td style="padding: 12px; font-weight: bold;"></td>');
            statusCell.text(item.status ? '直播中' : '已结束');
            statusCell.css('color', item.status ? '#27ae60' : '#95a5a6');
            row.append(statusCell);

            const actionCell = $('<td style="padding: 12px;"></td>');
            const toggleButton = $(`<button class="toggleLiveStatus" style="padding: 6px 12px; background: ${item.status ? '#ff6b6b' : '#4CAF50'}; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.3s;">${item.status ? '结束直播' : '开始直播'}</button>`);
            toggleButton.data('character', item.character_name);
            toggleButton.data('currentStatus', item.status);

            toggleButton.on('click', async function() {
                const button = $(this);
                const characterName = button.data('character');
                const newStatus = !button.data('currentStatus');

                try {
                    button.prop('disabled', true).text('处理中...');

                    // 更新直播状态
                    const updateResponse = await axios.post(
                        'http://43.162.120.233:8000/api/live/change_live_status',
                        new URLSearchParams({
                            uid: currentUser.uid,
                            character_name: item.character_name,
                            live_status: newStatus ? "start" : "stop"
                        }),
                        {
                            timeout: 5000,
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                        }
                    );

                    if (updateResponse.data.code === 0) {
                        // 更新UI
                        button.data('currentStatus', newStatus);
                        button.text(newStatus ? '结束直播' : '开始直播');
                        button.css('background', newStatus ? '#ff6b6b' : '#4CAF50');

                        // 更新状态显示
                        const statusCell = button.closest('tr').find('td:nth-child(2)');
                        statusCell.text(newStatus ? '直播中' : '已结束');
                        statusCell.css('color', newStatus ? '#27ae60' : '#95a5a6');
                    } else {
                        toastr.error('状态更新失败');
                    }
                } catch (error) {
                    toastr.error('请求失败');
                    console.error('直播状态更新错误:', error);
                } finally {
                    button.prop('disabled', false);
                }
            });

            actionCell.append(toggleButton);
            row.append(actionCell);
            tbody.append(row);
        });

        table.append(tbody);
        scrollContainer.append(table);  // 将表格放入滚动容器
        liveListTemplate.append(scrollContainer);  // 将滚动容器添加到模板

        // 添加刷新按钮（放在滚动容器外）
        const refreshButton = $('<button class="refreshLiveStatus" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; float: right; margin-top: 10px;">刷新状态</button>');
        refreshButton.on('click', async () => {
            refreshButton.text('刷新中...').prop('disabled', true);
            await livePlayPanel();
        });
        liveListTemplate.append(refreshButton);

        // 显示直播管理弹窗
        callGenericPopup(liveListTemplate, POPUP_TYPE.TEXT, '直播管理', {
            okButton: '关闭',
            wide: true,
            large: true,
            allowVerticalScrolling: true
        });

    } catch (error) {
        console.error('获取直播状态失败:', error);
        toastr.error('获取直播数据失败，请稍后再试');
    }
}












/**
 * Crop and upload an avatar image.
 * @param {string} handle User handle
 * @param {File} file Avatar file
 * @returns {Promise<string>}
 */
async function cropAndUploadAvatar(handle, file) {
    const dataUrl = await getBase64Async(await ensureImageFormatSupported(file));
    const croppedImage = await callGenericPopup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropAspect: 1, cropImage: dataUrl });
    if (!croppedImage) {
        return;
    }

    await changeAvatar(handle, String(croppedImage));

    return String(croppedImage);
}

/**
 * Change the avatar of the user.
 * @param {string} handle User handle
 * @param {string} avatar File to upload or base64 string
 * @returns {Promise<void>} Avatar URL
 */
async function changeAvatar(handle, avatar) {
    try {
        const response = await fetch('/api/users/change-avatar', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar, handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to change avatar');
            return;
        }
    } catch (error) {
        console.error('Error changing avatar:', error);
    }
}

async function openAdminPanel() {
    async function renderUsers() {
        const users = await getUsers();
        template.find('.usersList').empty();
        for (const user of users) {
            const userBlock = template.find('.userAccountTemplate .userAccount').clone();
            userBlock.find('.userName').text(user.name);
            userBlock.find('.userHandle').text(user.handle);
            userBlock.find('.userStatus').text(user.enabled ? 'Enabled' : 'Disabled');
            userBlock.find('.userRole').text(user.admin ? 'Admin' : 'User');
            userBlock.find('.avatar img').attr('src', user.avatar);
            userBlock.find('.hasPassword').toggle(user.password);
            userBlock.find('.noPassword').toggle(!user.password);
            userBlock.find('.userCreated').text(new Date(user.created).toLocaleString());
            userBlock.find('.userEnableButton').toggle(!user.enabled).on('click', () => enableUser(user.handle, renderUsers));
            userBlock.find('.userDisableButton').toggle(user.enabled).on('click', () => disableUser(user.handle, renderUsers));
            userBlock.find('.userPromoteButton').toggle(!user.admin).on('click', () => promoteUser(user.handle, renderUsers));
            userBlock.find('.userDemoteButton').toggle(user.admin).on('click', () => demoteUser(user.handle, renderUsers));
            userBlock.find('.userChangePasswordButton').on('click', () => changePassword(user.handle, renderUsers));
            userBlock.find('.userDelete').on('click', () => deleteUser(user.handle, renderUsers));
            userBlock.find('.userChangeNameButton').on('click', async () => changeName(user.handle, user.name, renderUsers));
            userBlock.find('.userBackupButton').on('click', function () {
                $(this).addClass('disabled').off('click');
                backupUserData(user.handle, renderUsers);
            });
            userBlock.find('.userAvatarChange').on('click', () => userBlock.find('.avatarUpload').trigger('click'));
            userBlock.find('.avatarUpload').on('change', async function () {
                if (!(this instanceof HTMLInputElement)) {
                    return;
                }

                const file = this.files[0];
                if (!file) {
                    return;
                }

                await cropAndUploadAvatar(user.handle, file);
                renderUsers();
            });
            userBlock.find('.userAvatarRemove').on('click', async function () {
                await changeAvatar(user.handle, '');
                renderUsers();
            });
            template.find('.usersList').append(userBlock);
        }
    }

    const template = $(await renderTemplateAsync('admin'));

    template.find('.adminNav > button').on('click', function () {
        const target = String($(this).data('target-tab'));
        template.find('.navTab').each(function () {
            $(this).toggle(this.classList.contains(target));
        });
    });

    template.find('.createUserDisplayName').on('input', async function () {
        const slug = await slugify(String($(this).val()));
        template.find('.createUserHandle').val(slug);
    });

    template.find('.userCreateForm').on('submit', function (event) {
        if (!(event.target instanceof HTMLFormElement)) {
            return;
        }

        event.preventDefault();
        createUser(event.target, () => {
            template.find('.manageUsersButton').trigger('click');
            renderUsers();
        });
    });

    callGenericPopup(template, POPUP_TYPE.TEXT, '', { okButton: 'Close', wide: false, large: false, allowVerticalScrolling: true, allowHorizontalScrolling: false });
    renderUsers();
}

/**
 * Log out the current user.
 * @returns {Promise<void>}
 */
async function logout() {
    await fetch('/api/users/logout', {
        method: 'POST',
        headers: getRequestHeaders(),
    });
    localStorage.removeItem("uid")
    // On an explicit logout stop auto login
    // to allow user to change username even
    // when auto auth (such as authelia or basic)
    // would be valid
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('noauto', 'true');

    window.location.search = urlParams.toString();
}

/**
 * Runs a text through the slugify API endpoint.
 * @param {string} text Text to slugify
 * @returns {Promise<string>} Slugified text
 */
async function slugify(text) {
    try {
        const response = await fetch('/api/users/slugify', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error('Failed to slugify text');
        }

        return response.text();
    } catch (error) {
        console.error('Error slugifying text:', error);
        return text;
    }
}

/**
 * Pings the server to extend the user session.
 */
async function extendUserSession() {
    try {
        const response = await fetch('/api/ping?extend=1', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Ping did not succeed', { cause: response.status });
        }
    } catch (error) {
        console.error('Failed to extend user session', error);
    }
}

jQuery(() => {
    $('#logout_button').on('click', () => {
        logout();
    });
    $('#admin_button').on('click', () => {
        openAdminPanel();
    });
    $('#account_button').on('click', () => {
        openUserProfile();
    });
    $('#start_play_button').on('click', () => {
        livePlayPanel();
    });
    setInterval(async () => {
        if (currentUser) {
            await extendUserSession();
        }
    }, SESSION_EXTEND_INTERVAL);
});
