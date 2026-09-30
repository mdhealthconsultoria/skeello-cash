import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Camera, Search, Link2, X, CheckCircle2 } from 'lucide-react'
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
}: {
  open: boolean
  onClose: () => void
  onCreated?: (person: Person) => void
  editPerson?: Person | null
}) {
  const { user } = useAuth()
  const { createPerson, updatePerson, findUserByEmail } = usePeople()
  const [name, setName] = useState(editPerson?.name ?? '')
  const [nickname, setNickname] = useState(editPerson?.nickname ?? '')
  const [phone, setPhone] = useState(editPerson?.phone ?? '')
  const [email, setEmail] = useState(editPerson?.email ?? '')
  const [notes, setNotes] = useState(editPerson?.notes ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(editPerson?.photo_url ?? null)
  const [loading, setLoading] = useState(false)

  const [searching, setSearching] = useState(false)
  const [linkedUser, setLinkedUser] = useState<FoundUser | null>(null)
  const [linkedUserId, setLinkedUserId] = useState<string | null>(editPerson?.linked_user_id ?? null)
  const [searchTried, setSearchTried] = useState(false)

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSearchUser() {
    if (!email.trim()) {
      toast.error('Digite o e-mail da pessoa pra buscar.')
      return
    }
    setSearching(true)
    setSearchTried(false)
    const { user: found, error } = await findUserByEmail(email.trim())
    setSearching(false)
    setSearchTried(true)
    if (found) {
      setLinkedUser(found)
      setLinkedUserId(found.id)
      if (!photoFile && found.avatar_url) setPhotoPreview(found.avatar_url)
      if (!name.trim()) setName(found.name)
    } else {
      setLinkedUser(null)
      setLinkedUserId(null)
      if (error) toast.error(error)
    }
  }

  function unlink() {
    setLinkedUser(null)
    setLinkedUserId(null)
    setSearchTried(false)
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

        <div>
          <label className="label">Nome *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nome completo" />
        </div>
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
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (linkedUserId) unlink()
              }}
              className="input flex-1"
              placeholder="voce@email.com"
            />
            <button
              type="button"
              onClick={handleSearchUser}
              disabled={searching}
              className="btn-secondary px-3 shrink-0"
              title="Buscar conta no Skeello Cash"
            >
              {searching ? <span className="w-4 h-4 border-2 border-ink-400 border-t-transparent rounded-full animate-spin" /> : <Search size={15} />}
            </button>
          </div>

          {linkedUser ? (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
              <Avatar src={linkedUser.avatar_url} name={linkedUser.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-900 dark:text-ink-50 truncate flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-brand-600 dark:text-brand-400 shrink-0" />
                  Vinculado a {linkedUser.name}
                </p>
                <p className="text-[11px] text-ink-400">Dívidas com essa pessoa poderão ser compartilhadas e confirmadas por ela.</p>
              </div>
              <button type="button" onClick={unlink} className="p-1 text-ink-400 hover:text-red-600 shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : searchTried ? (
            <p className="text-xs text-ink-400 mt-1.5 flex items-center gap-1">
              <Link2 size={12} /> Ninguém com esse e-mail usa o Skeello Cash ainda — tudo bem, fica só como contato.
            </p>
          ) : (
            <p className="text-xs text-ink-400 mt-1.5">Se essa pessoa também usa o Skeello Cash, busque pra vincular a conta dela.</p>
          )}
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
