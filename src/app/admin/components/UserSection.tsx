/* eslint-disable no-console */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { SectionConfigProps } from '@/lib/admin.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { styles, useLoadingState } from '@/app/admin/components/UIComponents';

const UserSection = ({
  config,
  role,
  refresh,
  showAlert,
  showError,
  showSuccess,
}: SectionConfigProps) => {
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const { isLoading, withLoading } = useLoadingState();
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [showAddUserGroupForm, setShowAddUserGroupForm] = useState(false);
  const [showEditUserGroupForm, setShowEditUserGroupForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    userGroup: '', // 新增用户组字段
  });
  const [changePasswordUser, setChangePasswordUser] = useState({
    username: '',
    password: '',
  });
  const [newUserGroup, setNewUserGroup] = useState({
    name: '',
    enabledApis: [] as string[],
  });
  const [editingUserGroup, setEditingUserGroup] = useState<{
    name: string;
    enabledApis: string[];
  } | null>(null);
  const [showConfigureApisModal, setShowConfigureApisModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    username: string;
    role: 'user' | 'admin' | 'owner';
    enabledApis?: string[];
    tags?: string[];
  } | null>(null);
  const [selectedApis, setSelectedApis] = useState<string[]>([]);
  const [showConfigureUserGroupModal, setShowConfigureUserGroupModal] =
    useState(false);
  const [selectedUserForGroup, setSelectedUserForGroup] = useState<{
    username: string;
    role: 'user' | 'admin' | 'owner';
    tags?: string[];
  } | null>(null);
  const [selectedUserGroups, setSelectedUserGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBatchUserGroupModal, setShowBatchUserGroupModal] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<string>('');
  const [showDeleteUserGroupModal, setShowDeleteUserGroupModal] =
    useState(false);
  const [deletingUserGroup, setDeletingUserGroup] = useState<{
    name: string;
    affectedUsers: Array<{
      username: string;
      role: 'user' | 'admin' | 'owner';
    }>;
  } | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  // 当前登录用户名
  const currentUsername = getAuthInfoFromBrowserCookie()?.username || null;

  // 使用 useMemo 计算全选状态，避免每次渲染都重新计算
  const selectAllUsers = useMemo(() => {
    const selectableUserCount =
      config?.UserConfig?.Users?.filter(
        (user) =>
          role === 'owner' ||
          (role === 'admin' &&
            (user.role === 'user' || user.username === currentUsername))
      ).length || 0;
    return selectedUsers.size === selectableUserCount && selectedUsers.size > 0;
  }, [selectedUsers.size, config?.UserConfig?.Users, role, currentUsername]);

  // 获取用户组列表
  const userGroups = config?.UserConfig?.Tags || [];

  // 处理用户组相关操作
  const handleUserGroupAction = async (
    action: 'add' | 'edit' | 'delete',
    groupName: string,
    enabledApis?: string[]
  ) => {
    return withLoading(`userGroup_${action}_${groupName}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: action,
            groupName,
            enabledApis,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        await refresh();

        if (action === 'add') {
          setNewUserGroup({ name: '', enabledApis: [] });
          setShowAddUserGroupForm(false);
        } else if (action === 'edit') {
          setEditingUserGroup(null);
          setShowEditUserGroupForm(false);
        }

        showSuccess(
          action === 'add'
            ? '用户组添加成功'
            : action === 'edit'
            ? '用户组更新成功'
            : '用户组删除成功',
          showAlert
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleAddUserGroup = () => {
    if (!newUserGroup.name.trim()) return;
    handleUserGroupAction('add', newUserGroup.name, newUserGroup.enabledApis);
  };

  const handleEditUserGroup = () => {
    if (!editingUserGroup?.name.trim()) return;
    handleUserGroupAction(
      'edit',
      editingUserGroup.name,
      editingUserGroup.enabledApis
    );
  };

  const handleDeleteUserGroup = (groupName: string) => {
    // 计算会受影响的用户数量
    const affectedUsers =
      config?.UserConfig?.Users?.filter(
        (user) => user.tags && user.tags.includes(groupName)
      ) || [];

    setDeletingUserGroup({
      name: groupName,
      affectedUsers: affectedUsers.map((u) => ({
        username: u.username,
        role: u.role,
      })),
    });
    setShowDeleteUserGroupModal(true);
  };

  const handleConfirmDeleteUserGroup = async () => {
    if (!deletingUserGroup) return;

    try {
      await handleUserGroupAction('delete', deletingUserGroup.name);
      setShowDeleteUserGroupModal(false);
      setDeletingUserGroup(null);
    } catch (err) {
      // 错误处理已在 handleUserGroupAction 中处理
    }
  };

  const handleStartEditUserGroup = (group: {
    name: string;
    enabledApis: string[];
  }) => {
    setEditingUserGroup({ ...group });
    setShowEditUserGroupForm(true);
    setShowAddUserGroupForm(false);
  };

  // 为用户分配用户组
  const handleAssignUserGroup = async (
    username: string,
    userGroups: string[]
  ) => {
    return withLoading(`assignUserGroup_${username}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUsername: username,
            action: 'updateUserGroups',
            userGroups,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        await refresh();
        showSuccess('用户组分配成功', showAlert);
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleBanUser = async (uname: string) => {
    await withLoading(`banUser_${uname}`, () => handleUserAction('ban', uname));
  };

  const handleUnbanUser = async (uname: string) => {
    await withLoading(`unbanUser_${uname}`, () =>
      handleUserAction('unban', uname)
    );
  };

  const handleSetAdmin = async (uname: string) => {
    await withLoading(`setAdmin_${uname}`, () =>
      handleUserAction('setAdmin', uname)
    );
  };

  const handleRemoveAdmin = async (uname: string) => {
    await withLoading(`removeAdmin_${uname}`, () =>
      handleUserAction('cancelAdmin', uname)
    );
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    await withLoading('addUser', async () => {
      await handleUserAction(
        'add',
        newUser.username,
        newUser.password,
        newUser.userGroup
      );
      setNewUser({ username: '', password: '', userGroup: '' });
      setShowAddUserForm(false);
    });
  };

  const handleChangePassword = async () => {
    if (!changePasswordUser.username || !changePasswordUser.password) return;
    await withLoading(
      `changePassword_${changePasswordUser.username}`,
      async () => {
        await handleUserAction(
          'changePassword',
          changePasswordUser.username,
          changePasswordUser.password
        );
        setChangePasswordUser({ username: '', password: '' });
        setShowChangePasswordForm(false);
      }
    );
  };

  const handleShowChangePasswordForm = (username: string) => {
    setChangePasswordUser({ username, password: '' });
    setShowChangePasswordForm(true);
    setShowAddUserForm(false); // 关闭添加用户表单
  };

  const handleCopyTVBoxUrl = (key: string) => {
    const tvBoxUrl = `${window.location.protocol}//${window.location.host}/api/tvbox?k=${key}`;
    try {
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(tvBoxUrl)
          .then(() => {
            showSuccess('TVBox API URL 已复制到剪贴板', showAlert);
          })
          .catch(() => {
            showError('复制失败，请手动复制', showAlert);
          });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = (username: string) => {
    setDeletingUser(username);
    setShowDeleteUserModal(true);
  };

  const handleConfigureUserApis = (user: {
    username: string;
    role: 'user' | 'admin' | 'owner';
    enabledApis?: string[];
  }) => {
    setSelectedUser(user);
    setSelectedApis(user.enabledApis || []);
    setShowConfigureApisModal(true);
  };

  const handleConfigureUserGroup = (user: {
    username: string;
    role: 'user' | 'admin' | 'owner';
    tags?: string[];
  }) => {
    setSelectedUserForGroup(user);
    setSelectedUserGroups(user.tags || []);
    setShowConfigureUserGroupModal(true);
  };

  const handleSaveUserGroups = async () => {
    if (!selectedUserForGroup) return;

    await withLoading(
      `saveUserGroups_${selectedUserForGroup.username}`,
      async () => {
        try {
          await handleAssignUserGroup(
            selectedUserForGroup.username,
            selectedUserGroups
          );
          setShowConfigureUserGroupModal(false);
          setSelectedUserForGroup(null);
          setSelectedUserGroups([]);
        } catch (err) {
          // 错误处理已在 handleAssignUserGroup 中处理
        }
      }
    );
  };

  // 处理用户选择
  const handleSelectUser = useCallback((username: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const newSelectedUsers = new Set(prev);
      if (checked) {
        newSelectedUsers.add(username);
      } else {
        newSelectedUsers.delete(username);
      }
      return newSelectedUsers;
    });
  }, []);

  const handleSelectAllUsers = useCallback(
    (checked: boolean) => {
      if (checked) {
        // 只选择自己有权限操作的用户
        const selectableUsernames =
          config?.UserConfig?.Users?.filter(
            (user) =>
              role === 'owner' ||
              (role === 'admin' &&
                (user.role === 'user' || user.username === currentUsername))
          ).map((u) => u.username) || [];
        setSelectedUsers(new Set(selectableUsernames));
      } else {
        setSelectedUsers(new Set());
      }
    },
    [config?.UserConfig?.Users, role, currentUsername]
  );

  // 批量设置用户组
  const handleBatchSetUserGroup = async (userGroup: string) => {
    if (selectedUsers.size === 0) return;

    await withLoading('batchSetUserGroup', async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batchUpdateUserGroups',
            usernames: Array.from(selectedUsers),
            userGroups: userGroup === '' ? [] : [userGroup],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        const userCount = selectedUsers.size;
        setSelectedUsers(new Set());
        setShowBatchUserGroupModal(false);
        setSelectedUserGroup('');
        showSuccess(
          `已为 ${userCount} 个用户设置用户组: ${userGroup}`,
          showAlert
        );

        // 刷新配置
        await refresh();
      } catch (err) {
        showError('批量设置用户组失败', showAlert);
        throw err;
      }
    });
  };

  const handleGenerateKey = async () => {
    if (selectedUsers.size === 0) return;

    await withLoading('generateKey', async () => {
      try {
        const res = await fetch('/api/admin/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usernames: Array.from(selectedUsers),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        const userCount = selectedUsers.size;
        setSelectedUsers(new Set());
        showSuccess(`已为 ${userCount} 个用户生成Key`, showAlert);

        // 刷新配置
        await refresh();
      } catch (err) {
        showError('生成Key失败', showAlert);
        throw err;
      }
    });
  };

  // 提取URL域名的辅助函数
  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // 如果URL格式不正确，返回原字符串
      return url;
    }
  };

  const handleSaveUserApis = async () => {
    if (!selectedUser) return;

    await withLoading(`saveUserApis_${selectedUser.username}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUsername: selectedUser.username,
            action: 'updateUserApis',
            enabledApis: selectedApis,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        // 成功后刷新配置
        await refresh();
        setShowConfigureApisModal(false);
        setSelectedUser(null);
        setSelectedApis([]);
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  // 通用请求函数
  const handleUserAction = async (
    action:
      | 'add'
      | 'ban'
      | 'unban'
      | 'setAdmin'
      | 'cancelAdmin'
      | 'changePassword'
      | 'deleteUser',
    targetUsername: string,
    targetPassword?: string,
    userGroup?: string
  ) => {
    try {
      const res = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername,
          ...(targetPassword ? { targetPassword } : {}),
          ...(userGroup ? { userGroup } : {}),
          action,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${res.status}`);
      }

      // 成功后刷新配置（无需整页刷新）
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;

    await withLoading(`deleteUser_${deletingUser}`, async () => {
      try {
        await handleUserAction('deleteUser', deletingUser);
        setShowDeleteUserModal(false);
        setDeletingUser(null);
      } catch (err) {
        // 错误处理已在 handleUserAction 中处理
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className={`${styles.roundedCard}`}>
        <div className='flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-0 gap-4'>
          <div className='flex space-x-8'>
            {[
              {
                id: 'users',
                name: '用户管理',
                count: config.UserConfig.Users.length,
              },
              { id: 'groups', name: '用户组管理', count: userGroups.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative pb-4 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <div className='flex items-center space-x-2'>
                  <span>{tab.name}</span>
                  {/* 这里的统计数字采用了 Badge 设计 */}
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full border ${
                      activeTab === tab.id
                        ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </div>
                {/* 激活状态的下划线动画 */}
                {activeTab === tab.id && (
                  <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500 rounded-full' />
                )}
              </button>
            ))}
          </div>
        </div>
        {/* 内容区域 */}
        <div className='mt-6 transition-all duration-300 ease-in-out'>
          {activeTab === 'users' ? (
            <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
              {/* 用户列表 */}
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center space-x-3'></div>
                  <div className='flex items-center space-x-2'>
                    {/* 批量操作按钮 */}
                    {selectedUsers.size > 0 && (
                      <>
                        <div className='flex items-center space-x-3'>
                          <span className='text-sm text-gray-600 dark:text-gray-400'>
                            已选择 {selectedUsers.size} 个用户
                          </span>
                          <button
                            onClick={() => handleGenerateKey()}
                            className={styles.secondary}
                          >
                            生成Key
                          </button>
                          <button
                            onClick={() => setShowBatchUserGroupModal(true)}
                            className={styles.primary}
                          >
                            批量设置用户组
                          </button>
                        </div>
                        <div className='w-px h-6 bg-gray-300 dark:bg-gray-600'></div>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowAddUserForm(!showAddUserForm);
                        if (showChangePasswordForm) {
                          setShowChangePasswordForm(false);
                          setChangePasswordUser({ username: '', password: '' });
                        }
                      }}
                      className={
                        showAddUserForm ? styles.secondary : styles.success
                      }
                    >
                      {showAddUserForm ? '取消' : '添加用户'}
                    </button>
                  </div>
                </div>

                {/* 添加用户表单 */}
                {showAddUserForm && (
                  <div className='mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
                    <div className='space-y-4'>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        <input
                          type='text'
                          placeholder='用户名'
                          value={newUser.username}
                          onChange={(e) =>
                            setNewUser((prev) => ({
                              ...prev,
                              username: e.target.value,
                            }))
                          }
                          className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                        />
                        <input
                          type='password'
                          placeholder='密码'
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser((prev) => ({
                              ...prev,
                              password: e.target.value,
                            }))
                          }
                          className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                          用户组（可选）
                        </label>
                        <select
                          value={newUser.userGroup}
                          onChange={(e) =>
                            setNewUser((prev) => ({
                              ...prev,
                              userGroup: e.target.value,
                            }))
                          }
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                        >
                          <option value=''>无用户组（无限制）</option>
                          {userGroups.map((group) => (
                            <option key={group.name} value={group.name}>
                              {group.name} (
                              {group.enabledApis && group.enabledApis.length > 0
                                ? `${group.enabledApis.length} 个源`
                                : '无限制'}
                              )
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className='flex justify-end'>
                        <button
                          onClick={handleAddUser}
                          disabled={
                            !newUser.username ||
                            !newUser.password ||
                            isLoading('addUser')
                          }
                          className={
                            !newUser.username ||
                            !newUser.password ||
                            isLoading('addUser')
                              ? styles.disabled
                              : styles.success
                          }
                        >
                          {isLoading('addUser') ? '添加中...' : '添加'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 修改密码表单 */}
                {showChangePasswordForm && (
                  <div className='mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
                    <h5 className='text-sm font-medium text-blue-800 dark:text-blue-300 mb-3'>
                      修改用户密码
                    </h5>
                    <div className='flex flex-col sm:flex-row gap-4 sm:gap-3'>
                      <input
                        type='text'
                        placeholder='用户名'
                        value={changePasswordUser.username}
                        disabled
                        className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed'
                      />
                      <input
                        type='password'
                        placeholder='新密码'
                        value={changePasswordUser.password}
                        onChange={(e) =>
                          setChangePasswordUser((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      />
                      <button
                        onClick={handleChangePassword}
                        disabled={
                          !changePasswordUser.password ||
                          isLoading(
                            `changePassword_${changePasswordUser.username}`
                          )
                        }
                        className={`w-full sm:w-auto ${
                          !changePasswordUser.password ||
                          isLoading(
                            `changePassword_${changePasswordUser.username}`
                          )
                            ? styles.disabled
                            : styles.primary
                        }`}
                      >
                        {isLoading(
                          `changePassword_${changePasswordUser.username}`
                        )
                          ? '修改中...'
                          : '修改密码'}
                      </button>
                      <button
                        onClick={() => {
                          setShowChangePasswordForm(false);
                          setChangePasswordUser({ username: '', password: '' });
                        }}
                        className={`w-full sm:w-auto ${styles.secondary}`}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {/* 用户列表 */}
                <div
                  className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
                  data-table='user-list'
                >
                  <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                    <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
                      <tr>
                        <th className='w-4' />
                        <th className='w-10 px-1 py-3 text-center'>
                          {(() => {
                            // 检查是否有权限操作任何用户
                            const hasAnyPermission =
                              config?.UserConfig?.Users?.some(
                                (user) =>
                                  role === 'owner' ||
                                  (role === 'admin' &&
                                    (user.role === 'user' ||
                                      user.username === currentUsername))
                              );

                            return hasAnyPermission ? (
                              <input
                                type='checkbox'
                                checked={selectAllUsers}
                                onChange={(e) =>
                                  handleSelectAllUsers(e.target.checked)
                                }
                                className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                              />
                            ) : (
                              <div className='w-4 h-4' />
                            );
                          })()}
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          用户名
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          key
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          角色
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          状态
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          用户组
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          采集源权限
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          操作
                        </th>
                      </tr>
                    </thead>
                    {/* 按规则排序用户：自己 -> 站长(若非自己) -> 管理员 -> 其他 */}
                    {(() => {
                      const sortedUsers = [...config.UserConfig.Users].sort(
                        (a, b) => {
                          type UserInfo =
                            (typeof config.UserConfig.Users)[number];
                          const priority = (u: UserInfo) => {
                            if (u.username === currentUsername) return 0;
                            if (u.role === 'owner') return 1;
                            if (u.role === 'admin') return 2;
                            return 3;
                          };
                          return priority(a) - priority(b);
                        }
                      );
                      return (
                        <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                          {sortedUsers.map((user) => {
                            // 修改密码权限：站长可修改管理员和普通用户密码，管理员可修改普通用户和自己的密码，但任何人都不能修改站长密码
                            const canChangePassword =
                              user.role !== 'owner' && // 不能修改站长密码
                              (role === 'owner' || // 站长可以修改管理员和普通用户密码
                                (role === 'admin' &&
                                  (user.role === 'user' ||
                                    user.username === currentUsername))); // 管理员可以修改普通用户和自己的密码

                            // 删除用户权限：站长可删除除自己外的所有用户，管理员仅可删除普通用户
                            const canDeleteUser =
                              user.username !== currentUsername &&
                              (role === 'owner' || // 站长可以删除除自己外的所有用户
                                (role === 'admin' && user.role === 'user')); // 管理员仅可删除普通用户

                            // 其他操作权限：不能操作自己，站长可操作所有用户，管理员可操作普通用户
                            const canOperate =
                              user.username !== currentUsername &&
                              (role === 'owner' ||
                                (role === 'admin' && user.role === 'user'));
                            return (
                              <tr
                                key={user.username}
                                className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                              >
                                <td className='w-4' />
                                <td className='w-10 px-1 py-3 text-center'>
                                  {role === 'owner' ||
                                  (role === 'admin' &&
                                    (user.role === 'user' ||
                                      user.username === currentUsername)) ? (
                                    <input
                                      type='checkbox'
                                      checked={selectedUsers.has(user.username)}
                                      onChange={(e) =>
                                        handleSelectUser(
                                          user.username,
                                          e.target.checked
                                        )
                                      }
                                      className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                                    />
                                  ) : (
                                    <div className='w-4 h-4' />
                                  )}
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                                  {user.username}
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                                  {user.key ? user.key : '--'}
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap'>
                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      user.role === 'owner'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                                        : user.role === 'admin'
                                        ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {user.role === 'owner'
                                      ? '站长'
                                      : user.role === 'admin'
                                      ? '管理员'
                                      : '普通用户'}
                                  </span>
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap'>
                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      !user.banned
                                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                    }`}
                                  >
                                    {!user.banned ? '正常' : '已封禁'}
                                  </span>
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap'>
                                  <div className='flex items-center space-x-2'>
                                    <span className='text-sm text-gray-900 dark:text-gray-100'>
                                      {user.tags && user.tags.length > 0
                                        ? user.tags.join(', ')
                                        : '无用户组'}
                                    </span>
                                    {/* 配置用户组按钮 */}
                                    {(role === 'owner' ||
                                      (role === 'admin' &&
                                        (user.role === 'user' ||
                                          user.username ===
                                            currentUsername))) && (
                                      <button
                                        onClick={() =>
                                          handleConfigureUserGroup(user)
                                        }
                                        className={styles.roundedPrimary}
                                      >
                                        配置
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap'>
                                  <div className='flex items-center space-x-2'>
                                    <span className='text-sm text-gray-900 dark:text-gray-100'>
                                      {user.enabledApis &&
                                      user.enabledApis.length > 0
                                        ? `${user.enabledApis.length} 个源`
                                        : '无限制'}
                                    </span>
                                    {/* 配置采集源权限按钮 */}
                                    {(role === 'owner' ||
                                      (role === 'admin' &&
                                        (user.role === 'user' ||
                                          user.username ===
                                            currentUsername))) && (
                                      <button
                                        onClick={() =>
                                          handleConfigureUserApis(user)
                                        }
                                        className={styles.roundedPrimary}
                                      >
                                        配置
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                                  <button
                                    onClick={() => handleCopyTVBoxUrl(user.key)}
                                    className={styles.roundedSuccess}
                                  >
                                    TVBox
                                  </button>
                                  {/* 修改密码按钮 */}
                                  {canChangePassword && (
                                    <button
                                      onClick={() =>
                                        handleShowChangePasswordForm(
                                          user.username
                                        )
                                      }
                                      className={styles.roundedPrimary}
                                    >
                                      修改密码
                                    </button>
                                  )}
                                  {canOperate && (
                                    <>
                                      {/* 其他操作按钮 */}
                                      {user.role === 'user' && (
                                        <button
                                          onClick={() =>
                                            handleSetAdmin(user.username)
                                          }
                                          disabled={isLoading(
                                            `setAdmin_${user.username}`
                                          )}
                                          className={`${styles.roundedPurple} ${
                                            isLoading(
                                              `setAdmin_${user.username}`
                                            )
                                              ? 'opacity-50 cursor-not-allowed'
                                              : ''
                                          }`}
                                        >
                                          设为管理
                                        </button>
                                      )}
                                      {user.role === 'admin' && (
                                        <button
                                          onClick={() =>
                                            handleRemoveAdmin(user.username)
                                          }
                                          disabled={isLoading(
                                            `removeAdmin_${user.username}`
                                          )}
                                          className={`${
                                            styles.roundedSecondary
                                          } ${
                                            isLoading(
                                              `removeAdmin_${user.username}`
                                            )
                                              ? 'opacity-50 cursor-not-allowed'
                                              : ''
                                          }`}
                                        >
                                          取消管理
                                        </button>
                                      )}
                                      {user.role !== 'owner' &&
                                        (!user.banned ? (
                                          <button
                                            onClick={() =>
                                              handleBanUser(user.username)
                                            }
                                            disabled={isLoading(
                                              `banUser_${user.username}`
                                            )}
                                            className={`${
                                              styles.roundedDanger
                                            } ${
                                              isLoading(
                                                `banUser_${user.username}`
                                              )
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                            }`}
                                          >
                                            封禁
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              handleUnbanUser(user.username)
                                            }
                                            disabled={isLoading(
                                              `unbanUser_${user.username}`
                                            )}
                                            className={`${
                                              styles.roundedSuccess
                                            } ${
                                              isLoading(
                                                `unbanUser_${user.username}`
                                              )
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                            }`}
                                          >
                                            解封
                                          </button>
                                        ))}
                                    </>
                                  )}
                                  {/* 删除用户按钮 - 放在最后，使用更明显的红色样式 */}
                                  {canDeleteUser && (
                                    <button
                                      onClick={() =>
                                        handleDeleteUser(user.username)
                                      }
                                      className={styles.roundedDanger}
                                    >
                                      删除用户
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      );
                    })()}
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
              {/* 用户组管理 */}
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'></h4>
                  <button
                    onClick={() => {
                      setShowAddUserGroupForm(!showAddUserGroupForm);
                      if (showEditUserGroupForm) {
                        setShowEditUserGroupForm(false);
                        setEditingUserGroup(null);
                      }
                    }}
                    className={
                      showAddUserGroupForm ? styles.secondary : styles.primary
                    }
                  >
                    {showAddUserGroupForm ? '取消' : '添加用户组'}
                  </button>
                </div>

                {/* 用户组列表 */}
                <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[20rem] overflow-y-auto overflow-x-auto relative'>
                  <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                    <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
                      <tr>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          用户组名称
                        </th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          可用视频源
                        </th>
                        <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {userGroups.map((group) => (
                        <tr
                          key={group.name}
                          className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                        >
                          <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {group.name}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='flex items-center space-x-2'>
                              <span className='text-sm text-gray-900 dark:text-gray-100'>
                                {group.enabledApis &&
                                group.enabledApis.length > 0
                                  ? `${group.enabledApis.length} 个源`
                                  : '无限制'}
                              </span>
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                            <button
                              onClick={() => handleStartEditUserGroup(group)}
                              disabled={isLoading(
                                `userGroup_edit_${group.name}`
                              )}
                              className={`${styles.roundedPrimary} ${
                                isLoading(`userGroup_edit_${group.name}`)
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteUserGroup(group.name)}
                              className={styles.roundedDanger}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                      {userGroups.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'
                          >
                            暂无用户组，请添加用户组来管理用户权限
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 配置用户采集源权限弹窗 */}
        {showConfigureApisModal &&
          selectedUser &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowConfigureApisModal(false);
                setSelectedUser(null);
                setSelectedApis([]);
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      配置用户采集源权限 - {selectedUser.username}
                    </h3>
                    <button
                      onClick={() => {
                        setShowConfigureApisModal(false);
                        setSelectedUser(null);
                        setSelectedApis([]);
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='mb-6'>
                    <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-blue-600 dark:text-blue-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                          配置说明
                        </span>
                      </div>
                      <p className='text-sm text-blue-700 dark:text-blue-400 mt-1'>
                        提示：全不选为无限制，选中的采集源将限制用户只能访问这些源
                      </p>
                    </div>
                  </div>

                  {/* 采集源选择 - 多列布局 */}
                  <div className='mb-6'>
                    <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      选择可用的采集源：
                    </h4>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {config?.SourceConfig?.map((source) => (
                        <label
                          key={source.key}
                          className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={selectedApis.includes(source.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedApis([...selectedApis, source.key]);
                              } else {
                                setSelectedApis(
                                  selectedApis.filter(
                                    (api) => api !== source.key
                                  )
                                );
                              }
                            }}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {source.name}
                            </div>
                            {source.api && (
                              <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                {extractDomain(source.api)}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 快速操作按钮 */}
                  <div className='flex flex-wrap items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
                    <div className='flex space-x-2'>
                      <button
                        onClick={() => setSelectedApis([])}
                        className={styles.quickAction}
                      >
                        全不选（无限制）
                      </button>
                      <button
                        onClick={() => {
                          const allApis =
                            config?.SourceConfig?.filter(
                              (source) => !source.disabled
                            ).map((s) => s.key) || [];
                          setSelectedApis(allApis);
                        }}
                        className={styles.quickAction}
                      >
                        全选
                      </button>
                    </div>
                    <div className='text-sm text-gray-600 dark:text-gray-400'>
                      已选择：
                      <span className='font-medium text-blue-600 dark:text-blue-400'>
                        {selectedApis.length > 0
                          ? `${selectedApis.length} 个源`
                          : '无限制'}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => {
                        setShowConfigureApisModal(false);
                        setSelectedUser(null);
                        setSelectedApis([]);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveUserApis}
                      disabled={isLoading(
                        `saveUserApis_${selectedUser?.username}`
                      )}
                      className={`px-6 py-2.5 text-sm font-medium ${
                        isLoading(`saveUserApis_${selectedUser?.username}`)
                          ? styles.disabled
                          : styles.primary
                      }`}
                    >
                      {isLoading(`saveUserApis_${selectedUser?.username}`)
                        ? '配置中...'
                        : '确认配置'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 添加用户组弹窗 */}
        {showAddUserGroupForm &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowAddUserGroupForm(false);
                setNewUserGroup({ name: '', enabledApis: [] });
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      添加新用户组
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddUserGroupForm(false);
                        setNewUserGroup({ name: '', enabledApis: [] });
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='space-y-6'>
                    {/* 用户组名称 */}
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        用户组名称
                      </label>
                      <input
                        type='text'
                        placeholder='请输入用户组名称'
                        value={newUserGroup.name}
                        onChange={(e) =>
                          setNewUserGroup((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      />
                    </div>

                    {/* 可用视频源 */}
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                        可用视频源
                      </label>
                      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                        {config?.SourceConfig?.map((source) => (
                          <label
                            key={source.key}
                            className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                          >
                            <input
                              type='checkbox'
                              checked={newUserGroup.enabledApis.includes(
                                source.key
                              )}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewUserGroup((prev) => ({
                                    ...prev,
                                    enabledApis: [
                                      ...prev.enabledApis,
                                      source.key,
                                    ],
                                  }));
                                } else {
                                  setNewUserGroup((prev) => ({
                                    ...prev,
                                    enabledApis: prev.enabledApis.filter(
                                      (api) => api !== source.key
                                    ),
                                  }));
                                }
                              }}
                              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                            />
                            <div className='flex-1 min-w-0'>
                              <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                                {source.name}
                              </div>
                              {source.api && (
                                <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                  {extractDomain(source.api)}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* 快速操作按钮 */}
                      <div className='mt-4 flex space-x-2'>
                        <button
                          onClick={() =>
                            setNewUserGroup((prev) => ({
                              ...prev,
                              enabledApis: [],
                            }))
                          }
                          className={styles.quickAction}
                        >
                          全不选（无限制）
                        </button>
                        <button
                          onClick={() => {
                            const allApis =
                              config?.SourceConfig?.filter(
                                (source) => !source.disabled
                              ).map((s) => s.key) || [];
                            setNewUserGroup((prev) => ({
                              ...prev,
                              enabledApis: allApis,
                            }));
                          }}
                          className={styles.quickAction}
                        >
                          全选
                        </button>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className='flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
                      <button
                        onClick={() => {
                          setShowAddUserGroupForm(false);
                          setNewUserGroup({ name: '', enabledApis: [] });
                        }}
                        className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddUserGroup}
                        disabled={
                          !newUserGroup.name.trim() ||
                          isLoading('userGroup_add_new')
                        }
                        className={`px-6 py-2.5 text-sm font-medium ${
                          !newUserGroup.name.trim() ||
                          isLoading('userGroup_add_new')
                            ? styles.disabled
                            : styles.primary
                        }`}
                      >
                        {isLoading('userGroup_add_new')
                          ? '添加中...'
                          : '添加用户组'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 编辑用户组弹窗 */}
        {showEditUserGroupForm &&
          editingUserGroup &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowEditUserGroupForm(false);
                setEditingUserGroup(null);
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      编辑用户组 - {editingUserGroup.name}
                    </h3>
                    <button
                      onClick={() => {
                        setShowEditUserGroupForm(false);
                        setEditingUserGroup(null);
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='space-y-6'>
                    {/* 可用视频源 */}
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                        可用视频源
                      </label>
                      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                        {config?.SourceConfig?.map((source) => (
                          <label
                            key={source.key}
                            className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                          >
                            <input
                              type='checkbox'
                              checked={editingUserGroup.enabledApis.includes(
                                source.key
                              )}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditingUserGroup((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          enabledApis: [
                                            ...prev.enabledApis,
                                            source.key,
                                          ],
                                        }
                                      : null
                                  );
                                } else {
                                  setEditingUserGroup((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          enabledApis: prev.enabledApis.filter(
                                            (api) => api !== source.key
                                          ),
                                        }
                                      : null
                                  );
                                }
                              }}
                              className='rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700'
                            />
                            <div className='flex-1 min-w-0'>
                              <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                                {source.name}
                              </div>
                              {source.api && (
                                <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                  {extractDomain(source.api)}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* 快速操作按钮 */}
                      <div className='mt-4 flex space-x-2'>
                        <button
                          onClick={() =>
                            setEditingUserGroup((prev) =>
                              prev ? { ...prev, enabledApis: [] } : null
                            )
                          }
                          className={styles.quickAction}
                        >
                          全不选（无限制）
                        </button>
                        <button
                          onClick={() => {
                            const allApis =
                              config?.SourceConfig?.filter(
                                (source) => !source.disabled
                              ).map((s) => s.key) || [];
                            setEditingUserGroup((prev) =>
                              prev ? { ...prev, enabledApis: allApis } : null
                            );
                          }}
                          className={styles.quickAction}
                        >
                          全选
                        </button>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className='flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
                      <button
                        onClick={() => {
                          setShowEditUserGroupForm(false);
                          setEditingUserGroup(null);
                        }}
                        className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleEditUserGroup}
                        disabled={isLoading(
                          `userGroup_edit_${editingUserGroup?.name}`
                        )}
                        className={`px-6 py-2.5 text-sm font-medium ${
                          isLoading(`userGroup_edit_${editingUserGroup?.name}`)
                            ? styles.disabled
                            : styles.primary
                        }`}
                      >
                        {isLoading(`userGroup_edit_${editingUserGroup?.name}`)
                          ? '保存中...'
                          : '保存修改'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 配置用户组弹窗 */}
        {showConfigureUserGroupModal &&
          selectedUserForGroup &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowConfigureUserGroupModal(false);
                setSelectedUserForGroup(null);
                setSelectedUserGroups([]);
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      配置用户组 - {selectedUserForGroup.username}
                    </h3>
                    <button
                      onClick={() => {
                        setShowConfigureUserGroupModal(false);
                        setSelectedUserForGroup(null);
                        setSelectedUserGroups([]);
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='mb-6'>
                    <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-blue-600 dark:text-blue-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                          配置说明
                        </span>
                      </div>
                      <p className='text-sm text-blue-700 dark:text-blue-400 mt-1'>
                        提示：选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                      </p>
                    </div>
                  </div>

                  {/* 用户组选择 - 下拉选择器 */}
                  <div className='mb-6'>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      选择用户组：
                    </label>
                    <select
                      value={
                        selectedUserGroups.length > 0
                          ? selectedUserGroups[0]
                          : ''
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedUserGroups(value ? [value] : []);
                      }}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                    >
                      <option value=''>无用户组（无限制）</option>
                      {userGroups.map((group) => (
                        <option key={group.name} value={group.name}>
                          {group.name}{' '}
                          {group.enabledApis && group.enabledApis.length > 0
                            ? `(${group.enabledApis.length} 个源)`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                      选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => {
                        setShowConfigureUserGroupModal(false);
                        setSelectedUserForGroup(null);
                        setSelectedUserGroups([]);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveUserGroups}
                      disabled={isLoading(
                        `saveUserGroups_${selectedUserForGroup?.username}`
                      )}
                      className={`px-6 py-2.5 text-sm font-medium ${
                        isLoading(
                          `saveUserGroups_${selectedUserForGroup?.username}`
                        )
                          ? styles.disabled
                          : styles.primary
                      }`}
                    >
                      {isLoading(
                        `saveUserGroups_${selectedUserForGroup?.username}`
                      )
                        ? '配置中...'
                        : '确认配置'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 删除用户组确认弹窗 */}
        {showDeleteUserGroupModal &&
          deletingUserGroup &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowDeleteUserGroupModal(false);
                setDeletingUserGroup(null);
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      确认删除用户组
                    </h3>
                    <button
                      onClick={() => {
                        setShowDeleteUserGroupModal(false);
                        setDeletingUserGroup(null);
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='mb-6'>
                    <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-red-600 dark:text-red-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-red-800 dark:text-red-300'>
                          危险操作警告
                        </span>
                      </div>
                      <p className='text-sm text-red-700 dark:text-red-400'>
                        删除用户组 <strong>{deletingUserGroup.name}</strong>{' '}
                        将影响所有使用该组的用户，此操作不可恢复！
                      </p>
                    </div>

                    {deletingUserGroup.affectedUsers.length > 0 ? (
                      <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
                        <div className='flex items-center space-x-2 mb-2'>
                          <svg
                            className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                            />
                          </svg>
                          <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                            ⚠️ 将影响 {deletingUserGroup.affectedUsers.length}{' '}
                            个用户：
                          </span>
                        </div>
                        <div className='space-y-1'>
                          {deletingUserGroup.affectedUsers.map(
                            (user, index) => (
                              <div
                                key={index}
                                className='text-sm text-yellow-700 dark:text-yellow-300'
                              >
                                • {user.username} ({user.role})
                              </div>
                            )
                          )}
                        </div>
                        <p className='text-xs text-yellow-600 dark:text-yellow-400 mt-2'>
                          这些用户的用户组将被自动移除
                        </p>
                      </div>
                    ) : (
                      <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4'>
                        <div className='flex items-center space-x-2'>
                          <svg
                            className='w-5 h-5 text-green-600 dark:text-green-400'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M5 13l4 4L19 7'
                            />
                          </svg>
                          <span className='text-sm font-medium text-green-800 dark:text-green-300'>
                            ✅ 当前没有用户使用此用户组
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => {
                        setShowDeleteUserGroupModal(false);
                        setDeletingUserGroup(null);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmDeleteUserGroup}
                      disabled={isLoading(
                        `userGroup_delete_${deletingUserGroup?.name}`
                      )}
                      className={`px-6 py-2.5 text-sm font-medium ${
                        isLoading(`userGroup_delete_${deletingUserGroup?.name}`)
                          ? styles.disabled
                          : styles.danger
                      }`}
                    >
                      {isLoading(`userGroup_delete_${deletingUserGroup?.name}`)
                        ? '删除中...'
                        : '确认删除'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 删除用户确认弹窗 */}
        {showDeleteUserModal &&
          deletingUser &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowDeleteUserModal(false);
                setDeletingUser(null);
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      确认删除用户
                    </h3>
                    <button
                      onClick={() => {
                        setShowDeleteUserModal(false);
                        setDeletingUser(null);
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='mb-6'>
                    <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-red-600 dark:text-red-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-red-800 dark:text-red-300'>
                          危险操作警告
                        </span>
                      </div>
                      <p className='text-sm text-red-700 dark:text-red-400'>
                        删除用户 <strong>{deletingUser}</strong>{' '}
                        将同时删除其搜索历史、播放记录和收藏夹，此操作不可恢复！
                      </p>
                    </div>

                    {/* 操作按钮 */}
                    <div className='flex justify-end space-x-3'>
                      <button
                        onClick={() => {
                          setShowDeleteUserModal(false);
                          setDeletingUser(null);
                        }}
                        className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleConfirmDeleteUser}
                        className={`px-6 py-2.5 text-sm font-medium ${styles.danger}`}
                      >
                        确认删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 批量设置用户组弹窗 */}
        {showBatchUserGroupModal &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={() => {
                setShowBatchUserGroupModal(false);
                setSelectedUserGroup('');
              }}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-6'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                      批量设置用户组
                    </h3>
                    <button
                      onClick={() => {
                        setShowBatchUserGroupModal(false);
                        setSelectedUserGroup('');
                      }}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <div className='mb-6'>
                    <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-blue-600 dark:text-blue-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                          批量操作说明
                        </span>
                      </div>
                      <p className='text-sm text-blue-700 dark:text-blue-400'>
                        将为选中的 <strong>{selectedUsers.size} 个用户</strong>{' '}
                        设置用户组，选择"无用户组"为无限制
                      </p>
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        选择用户组：
                      </label>
                      <select
                        onChange={(e) => setSelectedUserGroup(e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                        value={selectedUserGroup}
                      >
                        <option value=''>无用户组（无限制）</option>
                        {userGroups.map((group) => (
                          <option key={group.name} value={group.name}>
                            {group.name}{' '}
                            {group.enabledApis && group.enabledApis.length > 0
                              ? `(${group.enabledApis.length} 个源)`
                              : ''}
                          </option>
                        ))}
                      </select>
                      <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                        选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                      </p>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => {
                        setShowBatchUserGroupModal(false);
                        setSelectedUserGroup('');
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleBatchSetUserGroup(selectedUserGroup)}
                      disabled={isLoading('batchSetUserGroup')}
                      className={`px-6 py-2.5 text-sm font-medium ${
                        isLoading('batchSetUserGroup')
                          ? styles.disabled
                          : styles.primary
                      }`}
                    >
                      {isLoading('batchSetUserGroup')
                        ? '设置中...'
                        : '确认设置'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};
export default UserSection;
