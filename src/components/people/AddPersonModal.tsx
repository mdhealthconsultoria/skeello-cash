import { useEffect, useRef, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Camera, Link2, X, CheckCircle2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Avatar } from '../ui/Avatar'
import { usePeople } from '../../hooks/usePeople'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { FoundUser, Person } from '../../types/database'

export function AddPersonModal({
  open,
  onClose,
  onCreated,
  editPerson,
  presetUser,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (person: Person) => void
  editPerson?: Person | null
  presetUser?: FoundUser | null
}) {
  const { user } = useAuth()
  const { createPerson, updatePerson, searchUsersByName } = usePeople()
  const [name, setName] = useState(editPerson?.name ?? presetUser?.name ?? '')
  const [nickname, setNickname] = useState(editPerson?.nickname ?? '')
  const [phone, setPhone] = useState(editPerson?.phone ?? '')
  const [email, setEmail] = useState(editPerson?.email ?? '')
  const [notes, setNotes] = useState(editPerson?.notes ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(editPerson?.photo_url ?? presetUser?.avatar_url ?? null)
  const [loading, setLoading] = useState(false)

  const [results, setResults] = useState<FoundUser[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [linkedUser, setLinkedUser] = useState<FoundUser | null>(presetUser ?? null)
  const [linkedUserId, setLinkedUserId] = useState<string | null>(editPerson?.linked_user_id ?? presetUser?.id ?? null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (linkedUser) {
      setShowResults(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (name.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const { users } = await searchUsersByName(name)
      setSearching(false)
      setResults(users)
      setShowResults(true)
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, linkedUser])

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function selectUser(found: FoundUser) {
    setLinkedUser(found)
    setLinkedUserId(found.id)
    setName(found.name)
    if (!photoFile) setPhotoPreview(found.avatar_url)
    setShowResults(false)
  }

  function unlink() {
    setLinkedUser(null)
    setLinkedUserId(null)
    setResults([])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da pessoa.')
      return
    }
    setLoading(true)

    let photoUrl = editPerson?.photo_url ?? photoPreview
    if (photoFile && user) {
      const ext = photoFile.name.split('.').pop()
      const path = `${user.id}/people/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = data.publicUrl
      }
    }

    const payload = {
      name,
      nickname: nickname || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      photo_url: photoUrl,
      linked_user_id: linkedUserId,
    }

    const result = editPerson
      ? await updatePerson(editPerson.id, payload)
      : await createPerson(payload)

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(editPerson ? 'Pessoa atualizada!' : 'Pessoa adicionada!')
    onCreated?.(result.data as Person)
    onClose()
    if (!editPerson) {
      setName('')
      setNickname('')
      setPhone('')
      setEmail('')
      setNotes('')
      setPhotoFile(null)
      setPhotoPreview(null)
      unlink()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editPerson ? 'Editar pessoa' : 'Nova pessoa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <label className="relative cursor-pointer">
            <Avatar src={photoPreview} name={name || '?'} size="xl" />
            <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center border-2 border-white dark:border-ink-900">
              <Camera size={13} />
            </span>
            <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          </label>
        </div>

        <div className="relative">
          <label className="label">Nome *</label>
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (linkedUser) unlink()
            }}
            onFocus={() => results.length > 0 && !linkedUser && setShowResults(true)}
            className="input"
            placeholder="Nome completo"
            autoComplete="off"
          />
          {searching && (
            <span className="absolute right-3 top-9 w-4 h-4 border-2 border-ink-300 border-t-transparent rounded-full animate-spin" />
          )}

          {showResults && results.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-xl shadow-lg max-h-56 overflow-y-auto">
              <p className="px-3 pt-2 pb-1 text-[11px] text-ink-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-ink-900">
                Usuários do Skeello Cash
              </p>
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectUser(r)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50 dark:hover:bg-ink-800 text-left"
                >
                  <Avatar src={r.avatar_url} name={r.name} size="sm" />
                  <span className="text-sm text-ink-900 dark:text-ink-50 truncate">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {linkedUser && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
            <Avatar src={linkedUser.avatar_url} name={linkedUser.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink-900 dark:text-ink-50 truncate flex items-center gap-1">
                <CheckCircle2 size={12} className="text-brand-600 dark:text-brand-400 shrink-0" />
                Vinculado à conta de {linkedUser.name}
              </p>
              <p className="text-[11px] text-ink-400">
                Vocês vão poder cobrar/receber um do outro — a outra pessoa é avisada e confirma.
              </p>
            </div>
            <button type="button" onClick={unlink} className="p-1 text-ink-400 hover:text-red-600 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
        {!linkedUser && (
          <p className="text-xs text-ink-400 -mt-2 flex items-center gap-1">
            <Link2 size={12} /> Digitando o nome, mostramos quem já usa o Skeello Cash pra vincular.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Apelido</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div>
          <label className="label">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Opcional" />
        </div>
        <div>
          <label className="label">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" rows={2} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Salvando...' : editPerson ? 'Salvar alterações' : 'Adicionar pessoa'}
        </button>
      </form>
    </Modal>
  )
}
