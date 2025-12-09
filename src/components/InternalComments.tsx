import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquare, Pin, PinOff, Edit2, Trash2, Tag, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface InternalComment {
  id: string;
  patient_id: string;
  author_id: string;
  body: string;
  tags: string[];
  visibility_scope: 'team' | 'clinic';
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    nome: string;
    especialidade?: string;
  };
}

interface InternalCommentsProps {
  patientId: string;
}

const PREDEFINED_TAGS = [
  'medication-change',
  'risk',
  'improvement',
  'side-effects',
  'compliance',
  'therapy-notes',
  'emergency',
  'follow-up'
];

export const InternalComments: React.FC<InternalCommentsProps> = ({ patientId }) => {
  const { profile } = useAuth();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  
  const [comments, setComments] = useState<InternalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [visibilityScope, setVisibilityScope] = useState<'team' | 'clinic'>('team');
  const [isPinned, setIsPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterAuthor, setFilterAuthor] = useState<string>('');

  const shouldHide = flagsLoading || !isEnabled('internal_comments_v1') || profile?.tipo !== 'profissional';

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_comments')
        .select(`
          id,
          patient_id,
          author_id,
          body,
          tags,
          visibility_scope,
          is_pinned,
          created_at,
          updated_at
        `)
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author profiles separately
      if (data && data.length > 0) {
        const authorIds = [...new Set(data.map(comment => comment.author_id))];
        const { data: authorsData } = await supabase
          .from('profiles')
          .select('id, nome, especialidade')
          .in('id', authorIds);

        const commentsWithAuthors = data.map(comment => ({
          ...comment,
          visibility_scope: comment.visibility_scope as 'team' | 'clinic',
          author: authorsData?.find(author => author.id === comment.author_id) || { nome: 'Usuário Desconhecido' }
        }));

        setComments(commentsWithAuthors);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Erro ao carregar comentários internos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldHide) {
      fetchComments();
    }
  }, [patientId, shouldHide]);

  if (shouldHide) return null;

  const addTag = (tag: string) => {
    if (tag && !newTags.includes(tag)) {
      setNewTags([...newTags, tag]);
      setNewTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewTags(newTags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) {
      toast.error('Comentário não pode estar vazio');
      return;
    }

    try {
      const { error } = await supabase
        .from('internal_comments')
        .insert({
          patient_id: patientId,
          author_id: profile?.id,
          body: newComment.trim(),
          tags: newTags,
          visibility_scope: visibilityScope,
          is_pinned: isPinned
        });

      if (error) throw error;

      toast.success('Comentário interno adicionado');
      setNewComment('');
      setNewTags([]);
      setIsPinned(false);
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erro ao adicionar comentário');
    }
  };

  const togglePin = async (commentId: string, currentPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('internal_comments')
        .update({ is_pinned: !currentPinned })
        .eq('id', commentId);

      if (error) throw error;
      
      toast.success(currentPinned ? 'Comentário desafixado' : 'Comentário fixado');
      fetchComments();
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Erro ao fixar/desafixar comentário');
    }
  };

  const startEdit = (comment: InternalComment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const saveEdit = async (commentId: string) => {
    if (!editBody.trim()) {
      toast.error('Comentário não pode estar vazio');
      return;
    }

    try {
      const { error } = await supabase
        .from('internal_comments')
        .update({ body: editBody.trim() })
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Comentário atualizado');
      setEditingId(null);
      setEditBody('');
      fetchComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Erro ao atualizar comentário');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este comentário?')) return;

    try {
      const { error } = await supabase
        .from('internal_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Comentário excluído');
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Erro ao excluir comentário');
    }
  };

  const filteredComments = comments.filter(comment => {
    const matchesTag = !filterTag || filterTag === 'all' || comment.tags.includes(filterTag);
    const matchesAuthor = !filterAuthor || comment.author?.nome.toLowerCase().includes(filterAuthor.toLowerCase());
    return matchesTag && matchesAuthor;
  });

  if (loading) {
    return <div className="p-4">Carregando comentários...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notas da Equipe (Privado)</CardTitle>
          </div>
          <Badge variant="secondary" className="ml-auto">
            LGPD Compliant
          </Badge>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* New Comment Form */}
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar nova nota interna da equipe..."
              className="min-h-[100px]"
              maxLength={4000}
            />
            
            <div className="flex flex-wrap gap-2">
              {newTags.map(tag => (
                <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                  {tag} ×
                </Badge>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Adicionar tag..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(newTagInput))}
                className="flex-1"
              />
              <Select value={newTagInput} onValueChange={(value) => addTag(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tags predefinidas" />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_TAGS.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select value={visibilityScope} onValueChange={(value: 'team' | 'clinic') => setVisibilityScope(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Equipe</SelectItem>
                    <SelectItem value="clinic">Clínica</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  type="button"
                  variant={isPinned ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPinned(!isPinned)}
                >
                  <Pin className="h-4 w-4 mr-1" />
                  {isPinned ? 'Fixado' : 'Fixar'}
                </Button>
              </div>
              
              <Button type="submit" disabled={!newComment.trim()}>
                Adicionar Nota
              </Button>
            </div>
          </form>

          {/* Filters */}
          <div className="flex gap-2">
            <Input
              placeholder="Filtrar por autor..."
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value)}
              className="max-w-[200px]"
            />
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {PREDEFINED_TAGS.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comments List */}
          <div className="space-y-3">
            {filteredComments.map(comment => (
              <Card key={comment.id} className={`${comment.is_pinned ? 'border-primary' : ''}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{comment.author?.nome}</span>
                      {comment.author?.especialidade && (
                        <Badge variant="outline" className="text-xs">
                          {comment.author.especialidade}
                        </Badge>
                      )}
                      {comment.is_pinned && (
                        <Pin className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePin(comment.id, comment.is_pinned)}
                      >
                        {comment.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(comment)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteComment(comment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(comment.id)}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap mb-3">{comment.body}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      {comment.created_at !== comment.updated_at && (
                        <span>(editado)</span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {comment.visibility_scope}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-1">
                      {comment.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredComments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma nota interna encontrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};