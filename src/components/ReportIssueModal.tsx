import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Flag, Send, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getReportReasons, reportIssue, ReportReason } from '@/services/issueReportingService';

interface Issue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  created_at: string;
  image?: string;
}

interface ReportIssueModalProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

export default function ReportIssueModal({ 
  issue, 
  isOpen, 
  onClose, 
  onReportSubmitted 
}: ReportIssueModalProps) {
  const [reportReasons, setReportReasons] = useState<ReportReason[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchReportReasons();
      setSelectedReason('');
      setDescription('');
    }
  }, [isOpen]);

  const fetchReportReasons = async () => {
    try {
      setLoading(true);
      const reasons = await getReportReasons();
      setReportReasons(reasons);
    } catch (error) {
      console.error('Error fetching report reasons:', error);
      toast({
        title: "Error",
        description: "Failed to load report reasons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!issue || !selectedReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select a reason for reporting this issue",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await reportIssue(issue.id, selectedReason, description.trim() || undefined);
      
      if (result.success) {
        toast({
          title: "Issue Reported Successfully",
          description: result.message,
        });
        
        onClose();
        onReportSubmitted?.();
      } else {
        toast({
          title: "Report Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error reporting issue:', error);
      toast({
        title: "Report Failed",
        description: error.message || "Failed to report issue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!issue) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Report Issue to Admin
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Warning Message */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-800 mb-1">Report Suspicious Issue</h3>
                <p className="text-sm text-orange-700">
                  Use this feature to report issues that appear to be spam, fake, duplicate, or inappropriate. 
                  The admin will review your report and take appropriate action.
                </p>
              </div>
            </div>
          </div>

          {/* Issue Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">{issue.title}</h3>
            <p className="text-gray-600 mb-3">{issue.description}</p>
            <div className="flex gap-2 text-sm flex-wrap">
              <Badge variant="outline">{issue.category}</Badge>
              <Badge variant="outline">📍 {issue.location}</Badge>
              <Badge variant="outline">📅 {new Date(issue.created_at).toLocaleDateString()}</Badge>
              <Badge variant="outline" className="capitalize">
                {issue.status.replace('_', ' ').replace('-', ' ')}
              </Badge>
            </div>
          </div>

          {/* Report Reason Selection */}
          <div>
            <Label htmlFor="reason" className="text-sm font-medium mb-2 block">
              Reason for Reporting * <span className="text-red-500">(Required)</span>
            </Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-gray-600">Loading reasons...</span>
              </div>
            ) : (
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason for reporting this issue" />
                </SelectTrigger>
                <SelectContent>
                  {reportReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.reason}>
                      <div className="flex items-center justify-between w-full">
                        <span>{reason.reason}</span>
                        <Badge 
                          className={`ml-2 text-xs ${getSeverityColor(reason.severity)}`}
                          variant="outline"
                        >
                          {reason.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Show description for selected reason */}
            {selectedReason && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {reportReasons.find(r => r.reason === selectedReason)?.description}
                </p>
              </div>
            )}
          </div>

          {/* Additional Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Additional Details (Optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional details about why you're reporting this issue..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Help the admin understand the issue better by providing specific details
            </p>
          </div>

          {/* Quick Reason Buttons */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Select:</Label>
            <div className="flex flex-wrap gap-2">
              {reportReasons.slice(0, 4).map((reason) => (
                <Button
                  key={reason.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReason(reason.reason)}
                  className={`text-xs ${selectedReason === reason.reason ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  {reason.reason}
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Reporting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Report to Admin
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}