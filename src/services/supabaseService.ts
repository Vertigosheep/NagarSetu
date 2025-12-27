import { supabase } from '@/lib/supabase'
import { Issue, Event, User, Comment, PaginatedResponse, ApiResponse } from '@/types'
import { getErrorMessage } from '@/lib/utils'

// Base service class for common functionality
class BaseService {
  protected handleError(error: unknown, operation: string): never {
    console.error(`Error in ${operation}:`, error)
    throw new Error(getErrorMessage(error))
  }

  protected async executeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    operation: string
  ): Promise<T> {
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      if (!data) {
        throw new Error(`No data returned from ${operation}`)
      }
      
      return data
    } catch (error) {
      this.handleError(error, operation)
    }
  }
}

// Event Service
class EventService extends BaseService {
  async getAll(): Promise<Event[]> {
    return this.executeQuery(
      () => supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false }),
      'getEvents'
    )
  }

  async getById(id: string): Promise<Event | null> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error && error.code === 'PGRST116') {
        return null // Not found
      }
      
      if (error) {
        this.handleError(error, 'getEventById')
      }
      
      return data
    } catch (error) {
      this.handleError(error, 'getEventById')
    }
  }

  async create(eventData: Omit<Event, 'id' | 'created_at'>, userId: string): Promise<Event> {
    return this.executeQuery(
      () => supabase
        .from('events')
        .insert([{
          ...eventData,
          created_by: userId,
          status: 'upcoming',
          volunteers_count: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single(),
      'createEvent'
    )
  }

  async update(id: string, eventData: Partial<Event>): Promise<Event> {
    return this.executeQuery(
      () => supabase
        .from('events')
        .update(eventData)
        .eq('id', id)
        .select()
        .single(),
      'updateEvent'
    )
  }

  async delete(id: string): Promise<void> {
    await this.executeQuery(
      () => supabase
        .from('events')
        .delete()
        .eq('id', id),
      'deleteEvent'
    )
  }

  async getPaginated(limit: number, offset: number = 0): Promise<PaginatedResponse<Event>> {
    try {
      const { data, error, count } = await supabase
        .from('events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (error) {
        this.handleError(error, 'getPaginatedEvents')
      }
      
      return {
        data: data || [],
        totalCount: count || 0,
        hasMore: (count || 0) > offset + limit,
        page: Math.floor(offset / limit) + 1,
        limit
      }
    } catch (error) {
      this.handleError(error, 'getPaginatedEvents')
    }
  }

  async getByUser(userId: string): Promise<Event[]> {
    return this.executeQuery(
      () => supabase
        .from('events')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false }),
      'getUserEvents'
    )
  }
}

export const eventService = new EventService()

// Issue Service
class IssueService extends BaseService {
  async getAll(): Promise<Issue[]> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false }),
      'getIssues'
    )
  }

  async getById(id: string): Promise<Issue | null> {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error && error.code === 'PGRST116') {
        return null // Not found
      }
      
      if (error) {
        this.handleError(error, 'getIssueById')
      }
      
      return data
    } catch (error) {
      this.handleError(error, 'getIssueById')
    }
  }

  async create(issueData: Omit<Issue, 'id' | 'created_at' | 'comments_count' | 'volunteers_count'>, userId: string): Promise<Issue> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .insert([{
          ...issueData,
          created_by: userId,
          status: 'reported',
          comments_count: 0,
          volunteers_count: 0,
          upvotes_count: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single(),
      'createIssue'
    )
  }

  async update(id: string, issueData: Partial<Issue>): Promise<Issue> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .update({
          ...issueData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single(),
      'updateIssue'
    )
  }

  async delete(id: string): Promise<void> {
    await this.executeQuery(
      () => supabase
        .from('issues')
        .delete()
        .eq('id', id),
      'deleteIssue'
    )
  }

  async getPaginated(limit: number, offset: number = 0): Promise<PaginatedResponse<Issue>> {
    try {
      const { data, error, count } = await supabase
        .from('issues')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (error) {
        this.handleError(error, 'getPaginatedIssues')
      }
      
      return {
        data: data || [],
        totalCount: count || 0,
        hasMore: (count || 0) > offset + limit,
        page: Math.floor(offset / limit) + 1,
        limit
      }
    } catch (error) {
      this.handleError(error, 'getPaginatedIssues')
    }
  }

  async getByUser(userId: string): Promise<Issue[]> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false }),
      'getUserIssues'
    )
  }

  async getByCategory(category: string): Promise<Issue[]> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false }),
      'getIssuesByCategory'
    )
  }

  async getByStatus(status: string): Promise<Issue[]> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false }),
      'getIssuesByStatus'
    )
  }

  async assignToAuthority(issueId: string, authorityId: string, department: string): Promise<Issue> {
    return this.executeQuery(
      () => supabase
        .from('issues')
        .update({
          assigned_to: authorityId,
          department: department,
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId)
        .select()
        .single(),
      'assignIssue'
    )
  }

  async upvote(issueId: string, userId: string): Promise<void> {
    // First check if user already upvoted
    const { data: existingVote } = await supabase
      .from('issue_upvotes')
      .select('id')
      .eq('issue_id', issueId)
      .eq('user_id', userId)
      .single()

    if (existingVote) {
      throw new Error('You have already upvoted this issue')
    }

    // Add upvote and increment counter
    await this.executeQuery(
      () => supabase.rpc('upvote_issue', {
        issue_id: issueId,
        user_id: userId
      }),
      'upvoteIssue'
    )
  }
}

export const issueService = new IssueService()

// File Storage Service
class StorageService extends BaseService {
  async uploadFile(file: File, bucket: string, path: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file)
      
      if (error) {
        this.handleError(error, 'uploadFile')
      }
      
      return data.path
    } catch (error) {
      this.handleError(error, 'uploadFile')
    }
  }

  getFileUrl(bucket: string, path: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    
    return data.publicUrl
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await this.executeQuery(
      () => supabase.storage
        .from(bucket)
        .remove([path]),
      'deleteFile'
    )
  }
}

export const storageService = new StorageService()

// User Service
class UserService extends BaseService {
  async getProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error && error.code === 'PGRST116') {
        return null // Not found
      }
      
      if (error) {
        this.handleError(error, 'getUserProfile')
      }
      
      return data
    } catch (error) {
      this.handleError(error, 'getUserProfile')
    }
  }

  async updateProfile(userId: string, profileData: Partial<User>): Promise<User> {
    return this.executeQuery(
      () => supabase
        .from('user_profiles')
        .update(profileData)
        .eq('id', userId)
        .select()
        .single(),
      'updateUserProfile'
    )
  }

  async createProfile(profileData: Omit<User, 'created_at'>): Promise<User> {
    return this.executeQuery(
      () => supabase
        .from('user_profiles')
        .insert([{
          ...profileData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single(),
      'createUserProfile'
    )
  }
}

export const userService = new UserService()

// Comment Service
class CommentService extends BaseService {
  async getByIssue(issueId: string): Promise<Comment[]> {
    return this.executeQuery(
      () => supabase
        .from('comments')
        .select(`
          *,
          user_profiles!inner(full_name)
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true }),
      'getCommentsByIssue'
    )
  }

  async create(commentData: Omit<Comment, 'id' | 'created_at' | 'user_name'>): Promise<Comment> {
    return this.executeQuery(
      () => supabase
        .from('comments')
        .insert([{
          ...commentData,
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          user_profiles!inner(full_name)
        `)
        .single(),
      'createComment'
    )
  }

  async delete(commentId: string): Promise<void> {
    await this.executeQuery(
      () => supabase
        .from('comments')
        .delete()
        .eq('id', commentId),
      'deleteComment'
    )
  }
}

export const commentService = new CommentService()

// Export legacy functions for backward compatibility
export const getEvents = () => eventService.getAll()
export const getEventById = (id: string) => eventService.getById(id)
export const createEvent = (eventData: any, userId: string) => eventService.create(eventData, userId)
export const updateEvent = (id: string, eventData: any) => eventService.update(id, eventData)
export const deleteEvent = (id: string) => eventService.delete(id)
export const getUserEvents = (userId: string) => eventService.getByUser(userId)
export const getPaginatedEvents = (limit: number, offset?: number) => eventService.getPaginated(limit, offset)

export const getIssues = () => issueService.getAll()
export const getIssueById = (id: string) => issueService.getById(id)
export const createIssue = (issueData: any, userId: string) => issueService.create(issueData, userId)
export const updateIssue = (id: string, issueData: any) => issueService.update(id, issueData)
export const deleteIssue = (id: string) => issueService.delete(id)
export const getUserIssues = (userId: string) => issueService.getByUser(userId)

export const uploadFile = (file: File, bucket: string, path: string) => storageService.uploadFile(file, bucket, path)
export const getFileUrl = (bucket: string, path: string) => storageService.getFileUrl(bucket, path)