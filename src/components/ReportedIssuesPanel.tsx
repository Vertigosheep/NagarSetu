import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Flag, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Calendar, 
  MapPin, 
  User,
  AlertTriangle,
  Clock,
  MessageSquare
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { 
  getPendingReports, 
  getAllReports, 
  approveReportAndDeleteIssue, 
  rejectReport,
  getReportStatistics,
  IssueReportWithDetails 
} from '@/services/issueReportingService';

interface ReportedIssuesPanelProps {
  showOnlyPending?: boolean;
}

export default function ReportedIssuesPanel({ showOnlyPending = false }: ReportedIssuesPanelProps) {
  const [reports, setReports] = useState<IssueReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IssueReportWithDetails | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    fetchReports();
    fetchStatistics();
  }, [showOnlyPending]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = showOnlyPending ? await getPendingReports() : await getAllReports();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reported issues",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const stats = await getReportStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleReviewReport = (report: IssueReportWithDetails) => {
    setSelectedReport(report);
    setReviewNotes('');
    setReviewModalOpen(true);
  };

  const handleApproveReport = async () => {
    if (!selectedReport) return;

    setIsProcessing(true);
    try {
      const result = await approveReportAndDeleteIssue(selectedReport.id, reviewNotes.trim() || undefined);
      
      if (result.success) {
        toast({
          title: "Report Approved",
          description: result.message,
        });
        
        setReviewModalOpen(false);
        setSelectedReport(null);
        setReviewNotes('');
        fetchReports();
        fetchStatistics();
      }
    } catch (error: any) {
      console.error('Error approving report:', error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve report",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectReport = async () => {
    if (!selectedReport) return;

    setIsProcessing(true);
    try {
      const result = await rejectReport(selectedReport.id, reviewNotes.trim() || undefined);
      
      if (result.success) {
        toast({
          title: "Report Rejected",
          description: result.message,
        });
        
        setReviewModalOpen(false);
        setSelectedReport(null);
        setReviewNotes('');
        fetchReports();
        fetchStatistics();
      }
    } catch (error: any) {
      console.error('Error rejecting report:', error);
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject report",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReasonColor = (reason: string) => {
    if (reason.includes('Spam') || reason.includes('Fake')) {
      return 'bg-red-100 text-red-800 border-red-200';
    } else if (reason.includes('Duplicate')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (reason.includes('Inappropriate')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-600">Loading reported issues...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {statistics && !showOnlyPending && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Reports</p>
                  <p className="text-2xl font-bold">{statistics.total}</p>
                </div>
                <Flag className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.approved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            {showOnlyPending ? 'Pending Reports' : 'All Reported Issues'}
            {reports.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {reports.length} {reports.length === 1 ? 'report' : 'reports'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{showOnlyPending ? 'No pending reports' : 'No reports found'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{report.issue?.title}</h3>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status.toUpperCase()}
                          </Badge>
                          <Badge className={getReasonColor(report.report_reason)}>
                            {report.report_reason}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 mb-3 line-clamp-2">{report.issue?.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {report.issue?.location}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            Reported {new Date(report.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            {report.reporter?.full_name || report.reporter?.email || 'Pradhan'}
                          </div>
                        </div>

                        {report.report_description && (
                          <div className="bg-gray-50 p-3 rounded-lg mb-3">
                            <p className="text-sm text-gray-700">
                              <MessageSquare className="h-4 w-4 inline mr-1" />
                              {report.report_description}
                            </p>
                          </div>
                        )}

                        {report.status !== 'pending' && report.review_notes && (
                          <div className="bg-blue-50 p-3 rounded-lg mb-3">
                            <p className="text-sm text-blue-800">
                              <strong>Admin Review:</strong> {report.review_notes}
                            </p>
                            {report.reviewed_at && (
                              <p className="text-xs text-blue-600 mt-1">
                                Reviewed on {new Date(report.reviewed_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {report.status === 'pending' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleReviewReport(report)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Review Reported Issue</DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6">
              {/* Issue Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">{selectedReport.issue?.title}</h3>
                <p className="text-gray-600 mb-3">{selectedReport.issue?.description}</p>
                <div className="flex gap-2 text-sm flex-wrap">
                  <Badge variant="outline">{selectedReport.issue?.category}</Badge>
                  <Badge variant="outline">📍 {selectedReport.issue?.location}</Badge>
                  <Badge variant="outline">📅 {new Date(selectedReport.issue?.created_at || '').toLocaleDateString()}</Badge>
                </div>
              </div>

              {/* Report Details */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 mb-2">Report Details</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Reason:</strong> 
                        <Badge className={`ml-2 ${getReasonColor(selectedReport.report_reason)}`}>
                          {selectedReport.report_reason}
                        </Badge>
                      </div>
                      <div>
                        <strong>Reported by:</strong> {selectedReport.reporter?.full_name || selectedReport.reporter?.email || 'Pradhan'}
                      </div>
                      <div>
                        <strong>Reported on:</strong> {new Date(selectedReport.created_at).toLocaleDateString()}
                      </div>
                      {selectedReport.report_description && (
                        <div>
                          <strong>Additional Details:</strong>
                          <p className="mt-1 text-red-700">{selectedReport.report_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <Label htmlFor="reviewNotes" className="text-sm font-medium mb-2 block">
                  Review Notes (Optional)
                </Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setReviewModalOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRejectReport}
                  disabled={isProcessing}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Reject Report
                    </span>
                  )}
                </Button>
                <Button
                  onClick={handleApproveReport}
                  disabled={isProcessing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Approve & Delete Issue
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}