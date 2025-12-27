import React, { useState, useEffect } from 'react';
import { X, User, Building, IdCard, Phone, MapPin, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as UserType } from '@/types';

interface AssignWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  issueTitle: string;
  onAssignSuccess: () => void;
}

const AssignWorkerModal: React.FC<AssignWorkerModalProps> = ({
  isOpen,
  onClose,
  issueId,
  issueTitle,
  onAssignSuccess
}) => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [workers, setWorkers] = useState<UserType[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<UserType[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchWorkersByDepartment(selectedDepartment);
    }
  }, [selectedDepartment]);

  useEffect(() => {
    filterWorkers();
  }, [workers, searchQuery]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('department')
        .eq('user_type', 'official')
        .not('department', 'is', null);

      if (error) throw error;

      // Get unique departments
      const uniqueDepts = [...new Set(data.map(d => d.department))].filter(Boolean) as string[];
      setDepartments(uniqueDepts.sort());
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchWorkersByDepartment = async (department: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_type', 'official')
        .eq('department', department)
        .eq('is_onboarding_complete', true)
        .order('full_name');

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterWorkers = () => {
    if (!searchQuery.trim()) {
      setFilteredWorkers(workers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = workers.filter(worker =>
      worker.full_name?.toLowerCase().includes(query) ||
      worker.employee_id?.toLowerCase().includes(query) ||
      worker.email?.toLowerCase().includes(query)
    );
    setFilteredWorkers(filtered);
  };

  const handleAssign = async () => {
    if (!selectedWorker || !selectedDepartment) return;

    setAssigning(true);
    try {
      const { error } = await supabase
        .from('issues')
        .update({
          assigned_to: selectedWorker,
          status: 'assigned',
          department: selectedDepartment,
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId);

      if (error) throw error;

      onAssignSuccess();
      onClose();
    } catch (error) {
      console.error('Error assigning worker:', error);
      alert('Failed to assign worker. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Assign Worker
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {issueTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Select Department */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step 1: Select Department <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedWorker('');
                  setSearchQuery('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">Choose a department...</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Select Worker */}
          {selectedDepartment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Step 2: Select Worker <span className="text-red-500">*</span>
              </label>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, employee ID, or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Workers List */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">Loading workers...</p>
                </div>
              ) : filteredWorkers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchQuery ? 'No workers found matching your search' : 'No workers available in this department'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      onClick={() => setSelectedWorker(worker.id)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        selectedWorker === worker.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {worker.full_name}
                            </h3>
                            {selectedWorker === worker.id && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <IdCard className="w-4 h-4" />
                              <span>{worker.employee_id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{worker.email}</span>
                            </div>
                            {worker.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span>{worker.phone}</span>
                              </div>
                            )}
                            {worker.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span className="line-clamp-1">{worker.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedWorker || assigning}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {assigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Assigning...
              </>
            ) : (
              'Assign Worker'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignWorkerModal;
