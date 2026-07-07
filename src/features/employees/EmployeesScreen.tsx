import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { useAppSelector } from '../../store';
import { useTenant } from '../../context/TenantContext';
import { usePermission } from '../../rbac/usePermission';
import { UserRole, getRoleLabel, getCreatableRoles } from '../../rbac/roles';
import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';
import { auditService } from '../../services/auditService';
import { syncQueue } from '../../api/sync/syncQueue';
import {
  UserCog, Plus, Search, Edit3, UserX, UserCheck,
  Mail, Phone, Lock, ChevronDown, X, Shield, Building2, Trash2,
} from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  pin: string | null;
  branch_id: string | null;
  supermarket_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  supermarket_id?: string | null;
}

interface SupermarketLookup {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  super_admin:  '#8b5cf6',
  admin:        '#3b82f6',
  manager:      '#10b981',
  cashier:      '#f59e0b',
  store_keeper: '#ef4444',
  accountant:   '#06b6d4',
  platform_owner: '#4b5563',
};

function roleBadgeColor(role: UserRole): string {
  return ROLE_COLORS[role] || '#6b7280';
}

// ---------------------------------------------------------------------------
// Employee Form Modal
// ---------------------------------------------------------------------------

interface EmployeeFormProps {
  visible: boolean;
  employee: Employee | null;
  creatableRoles: UserRole[];
  branches: Branch[];
  onClose: () => void;
  onSave: (data: Partial<Employee> & { pin?: string }) => Promise<void>;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  visible, employee, creatableRoles, branches, onClose, onSave,
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState('');
  const [role, setRole]       = useState<UserRole>(creatableRoles[0] || 'cashier');
  const [branchId, setBranchId] = useState<string>('');
  const [saving, setSaving]   = useState(false);
  const [showRolePicker, setShowRolePicker]     = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setPin('');
      setRole(employee.role);
      setBranchId(employee.branch_id || '');
    } else {
      setName(''); setEmail(''); setPhone(''); setPin('');
      setRole(creatableRoles[0] || 'cashier');
      setBranchId('');
    }
  }, [employee, visible, creatableRoles]);

  const handleSave = async () => {
    if (!name.trim()) { alert('Validation: Name is required.'); return; }
    if (!employee && pin.length < 4) { alert('Validation: PIN must be at least 4 digits.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role,
        branch_id: branchId || null,
        pin: pin || undefined,
      });
      onClose();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    sheet: { width: '100%', maxWidth: 500, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl },
    title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.lg },
    label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md,
      backgroundColor: colors.background, color: colors.onSurface,
      paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.md, fontSize: 15,
    },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md,
      backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: 12,
      marginBottom: spacing.md,
    },
    pickerText: { fontSize: 15, color: colors.onSurface },
    pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
    pickerBox: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, width: 280, maxHeight: 400, overflow: 'hidden' },
    pickerItem: { paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant },
    pickerItemText: { fontSize: 15, color: colors.onSurface },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    btnText: { fontSize: 15, fontWeight: '700' },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>{employee ? 'Edit User' : 'Add User'}</Text>
          
          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Email Address (Optional)</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="john@example.com" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Phone Number (Optional)</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+2547..." placeholderTextColor={colors.onSurfaceVariant} />

          {!employee && (
            <>
              <Text style={s.label}>Login PIN (4+ digits)</Text>
              <TextInput style={s.input} value={pin} onChangeText={setPin} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="1234" placeholderTextColor={colors.onSurfaceVariant} />
            </>
          )}

          <Text style={s.label}>Role</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setShowRolePicker(true)}>
            <Text style={s.pickerText}>{getRoleLabel(role)}</Text>
            <ChevronDown size={18} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          {branches.length > 0 && (
            <>
              <Text style={s.label}>Branch (Optional)</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => setShowBranchPicker(true)}>
                <Text style={s.pickerText}>
                  {branches.find(b => b.id === branchId)?.name || 'All Branches (Default)'}
                </Text>
                <ChevronDown size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </>
          )}

          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={[s.btnText, { color: '#fff' }]}>{employee ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Role Picker Modal */}
      {showRolePicker && (
        <View style={s.pickerOverlay}>
          <View style={s.pickerBox}>
            <FlatList
              data={creatableRoles}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerItem}
                  onPress={() => { setRole(item); setShowRolePicker(false); }}>
                  <Text style={s.pickerItemText}>{getRoleLabel(item)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {/* Branch Picker Modal */}
      {showBranchPicker && (
        <View style={s.pickerOverlay}>
          <View style={s.pickerBox}>
            <TouchableOpacity
              style={s.pickerItem}
              onPress={() => { setBranchId(''); setShowBranchPicker(false); }}>
              <Text style={[s.pickerItemText, { fontWeight: 'bold' }]}>All Branches (Default)</Text>
            </TouchableOpacity>
            <FlatList
              data={branches}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerItem}
                  onPress={() => { setBranchId(item.id); setShowBranchPicker(false); }}>
                  <Text style={s.pickerItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main Employees Screen
// ---------------------------------------------------------------------------

export const EmployeesScreen: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const currentUser = useAppSelector(state => state.auth.currentUser);
  const { supermarketId } = useTenant();
  const canManage  = usePermission('manage_employees');
  const canResetPin = usePermission('reset_user_pin');
  const isPlatformOwner = currentUser?.role === 'platform_owner';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [supermarkets, setSupermarkets] = useState<SupermarketLookup[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');

  const creatableRoles = getCreatableRoles(currentUser?.role || 'cashier');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isPlatformOwner) {
        // Load all supermarkets lookup
        const smRes = await db.execute('SELECT id, name FROM supermarkets WHERE deleted = 0');
        setSupermarkets(smRes.rows as SupermarketLookup[]);

        // Load all branches
        const branchRes = await db.execute(
          'SELECT id, name, supermarket_id FROM branches WHERE deleted = 0 ORDER BY name',
          []
        );
        setBranches(branchRes.rows as Branch[]);

        // Load all users
        const empRes = await db.execute(
          `SELECT * FROM users WHERE deleted = 0 AND role != 'platform_owner' ORDER BY name`,
          []
        );
        setEmployees(empRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          role: r.role as UserRole,
          pin: r.pin || null,
          branch_id: r.branch_id || null,
          supermarket_id: r.supermarket_id || null,
          is_active: r.is_active === 1 || r.is_active === true,
          created_at: r.created_at,
        })));
      } else {
        // Load branches for current supermarket
        const branchRes = await db.execute(
          'SELECT id, name FROM branches WHERE supermarket_id = ? AND deleted = 0 ORDER BY name',
          [supermarketId]
        );
        setBranches(branchRes.rows as Branch[]);

        // Load employees for current supermarket
        const empRes = await db.execute(
          `SELECT * FROM users WHERE supermarket_id = ? AND deleted = 0 AND role != 'platform_owner' ORDER BY name`,
          [supermarketId]
        );
        setEmployees(empRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          role: r.role as UserRole,
          pin: r.pin || null,
          branch_id: r.branch_id || null,
          supermarket_id: r.supermarket_id || null,
          is_active: r.is_active === 1 || r.is_active === true,
          created_at: r.created_at,
        })));
      }
    } catch (e) {
      console.error('Failed to load employees', e);
    } finally {
      setLoading(false);
    }
  }, [supermarketId, isPlatformOwner]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (data: Partial<Employee> & { pin?: string }) => {
    const now = new Date().toISOString();
    try {
      if (editingEmployee) {
        // Update existing
        const fields: string[] = ['name=?', 'email=?', 'phone=?', 'role=?', 'branch_id=?', 'updated_at=?', 'version=version+1', "synced=0", "sync_status='pending'"];
        const vals: any[] = [data.name, data.email, data.phone, data.role, data.branch_id, now];
        if (data.pin) { fields.push('pin=?'); vals.push(data.pin); }
        vals.push(editingEmployee.id);
        await db.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals);
        
        const updatedRes = await db.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [editingEmployee.id]);
        if (updatedRes.rows.length > 0) {
          await syncQueue.addToQueue('users', editingEmployee.id, 'UPDATE', updatedRes.rows[0]);
        }
        
        await auditService.log({ action: 'user_updated', table_name: 'users', record_id: editingEmployee.id, new_values: data });
        alert('Success: User updated successfully.');
      } else {
        // Insert new
        const id = generateUUID();
        const targetSupermarketId = isPlatformOwner ? null : supermarketId;
        await db.execute(
          `INSERT INTO users (id,supermarket_id,branch_id,name,email,phone,role,pin,is_active,created_at,updated_at,deleted,version,synced,sync_status)
           VALUES (?,?,?,?,?,?,?,?,1,?,?,0,1,0,'pending')`,
          [id, targetSupermarketId, data.branch_id || null, data.name, data.email, data.phone, data.role, data.pin, now, now]
        );
        
        const insertedRes = await db.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
        if (insertedRes.rows.length > 0) {
          await syncQueue.addToQueue('users', id, 'INSERT', insertedRes.rows[0]);
        }
        
        await auditService.log({ action: 'user_created', table_name: 'users', record_id: id, new_values: data });
        alert('Success: User created successfully.');
      }
      setModalVisible(false);
      setEditingEmployee(null);
    } catch (e: any) {
      console.error('Failed to save employee', e);
      alert('Save Failed: ' + (e.message || 'An unknown error occurred while saving the employee.'));
      throw e;
    }
    await loadData();
  };

  const handleToggleActive = async (emp: Employee) => {
    const newStatus = !emp.is_active;
    Alert.alert(
      newStatus ? 'Activate User' : 'Deactivate User',
      `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${emp.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const now = new Date().toISOString();
              await db.execute(
                `UPDATE users SET is_active=?, updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
                [newStatus ? 1 : 0, now, emp.id]
              );
              
              const updatedRes = await db.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [emp.id]);
              if (updatedRes.rows.length > 0) {
                await syncQueue.addToQueue('users', emp.id, 'UPDATE', updatedRes.rows[0]);
              }
              
              await auditService.log({ action: newStatus ? 'user_activated' : 'user_deactivated', table_name: 'users', record_id: emp.id });
              Alert.alert('Success', `User ${newStatus ? 'activated' : 'deactivated'} successfully.`);
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to update user status.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = async (emp: Employee) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to completely delete ${emp.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const now = new Date().toISOString();
              await db.execute(
                `UPDATE users SET deleted=1, updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
                [now, emp.id]
              );
              
              const updatedRes = await db.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [emp.id]);
              if (updatedRes.rows.length > 0) {
                await syncQueue.addToQueue('users', emp.id, 'UPDATE', updatedRes.rows[0]);
              }
              
              await auditService.log({ action: 'user_deleted', table_name: 'users', record_id: emp.id });
              Alert.alert('Success', `User ${emp.name} deleted successfully.`);
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete user.');
            }
          },
        },
      ]
    );
  };

  const filtered = employees.filter(e => {
    const matchRole   = filterRole === 'all' || e.role === filterRole;
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
      || (e.email || '').toLowerCase().includes(search.toLowerCase())
      || (e.phone || '').includes(search);
    return matchRole && matchSearch;
  });

  const allRolesInList = Array.from(new Set(employees.map(e => e.role)));

  const renderEmployee = ({ item }: { item: Employee }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.surfaceVariant }]}>
      <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success || '#10b981' : colors.error }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.empName, { color: colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor(item.role) + '22' }]}>
            <Text style={[styles.roleBadgeText, { color: roleBadgeColor(item.role) }]}>{getRoleLabel(item.role)}</Text>
          </View>
        </View>
        {item.email && (
          <View style={styles.cardDetail}>
            <Mail size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.cardDetailText, { color: colors.onSurfaceVariant }]}>{item.email}</Text>
          </View>
        )}
        {item.phone && (
          <View style={styles.cardDetail}>
            <Phone size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.cardDetailText, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
          </View>
        )}
        {isPlatformOwner && item.supermarket_id && (
          <View style={styles.cardDetail}>
            <Building2 size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.cardDetailText, { color: colors.onSurfaceVariant, fontWeight: '600' }]}>
              {supermarkets.find(s => s.id === item.supermarket_id)?.name || 'Unknown Store'}
            </Text>
          </View>
        )}
        {item.branch_id && (
          <View style={styles.cardDetail}>
            <Shield size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.cardDetailText, { color: colors.onSurfaceVariant }]}>
              {branches.find(b => b.id === item.branch_id)?.name || item.branch_id}
            </Text>
          </View>
        )}
        {!item.is_active && (
          <Text style={[styles.inactiveLabel, { color: colors.error }]}>Deactivated</Text>
        )}
      </View>
      {canManage && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.surfaceVariant }]} onPress={() => { setEditingEmployee(item); setModalVisible(true); }}>
            <Edit3 size={15} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.surfaceVariant, marginTop: 6 }]}
            onPress={() => handleToggleActive(item)}>
            {item.is_active
              ? <UserX size={15} color={colors.error} />
              : <UserCheck size={15} color={colors.success || '#10b981'} />}
          </TouchableOpacity>
          {(isPlatformOwner || currentUser?.role === 'super_admin') && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.surfaceVariant, marginTop: 6, backgroundColor: colors.error + '11' }]}
              onPress={() => handleDeleteUser(item)}>
              <Trash2 size={15} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <UserCog size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Employees</Text>
        </View>
        {canManage && creatableRoles.length > 0 && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => { setEditingEmployee(null); setModalVisible(true); }}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Employee</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search & Filters */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <Search size={16} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search employees..."
            placeholderTextColor={colors.onSurfaceVariant}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleFilters}>
          {(['all', ...allRolesInList] as (UserRole | 'all')[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.roleFilterBtn, {
                backgroundColor: filterRole === r ? colors.primary : colors.background,
                borderColor: filterRole === r ? colors.primary : colors.surfaceVariant,
                borderRadius: borderRadius.full || 999,
              }]}
              onPress={() => setFilterRole(r)}>
              <Text style={[styles.roleFilterText, { color: filterRole === r ? '#fff' : colors.onSurfaceVariant }]}>
                {r === 'all' ? 'All' : getRoleLabel(r as UserRole)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <Text style={[styles.statsText, { color: colors.onSurfaceVariant }]}>
          {filtered.length} employee{filtered.length !== 1 ? 's' : ''} · {filtered.filter(e => e.is_active).length} active
        </Text>
      </View>

      {/* Employee List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <UserCog size={48} color={colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            {search ? 'No employees match your search.' : 'No employees found.'}
          </Text>
          {canManage && !search && (
            <Text style={[styles.emptySubText, { color: colors.onSurfaceVariant }]}>Tap "Add Employee" to get started.</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderEmployee}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal */}
      <EmployeeForm
        visible={modalVisible}
        employee={editingEmployee}
        creatableRoles={creatableRoles}
        branches={branches}
        onClose={() => { setModalVisible(false); setEditingEmployee(null); }}
        onSave={handleSave}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  roleFilters: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  roleFilterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  roleFilterText: { fontSize: 13, fontWeight: '600' },
  statsRow: { paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1 },
  statsText: { fontSize: 13 },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  statusDot: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  empName: { fontSize: 15, fontWeight: '700', flex: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  cardDetailText: { fontSize: 12 },
  inactiveLabel: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  cardActions: { paddingVertical: 14, paddingRight: 12, justifyContent: 'center' },
  actionBtn: { padding: 8, borderWidth: 1, borderRadius: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 14, marginTop: 6 },
});
