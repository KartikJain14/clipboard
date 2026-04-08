// app/components/ClipboardNavbar.jsx
import styles from './ClipboardNavbar.module.css';

export default function ClipboardNavbar({
  onShare = () => {},
  onDeleteRoom = () => {},
  onLogout = () => {},
  densityMode = 'lazy',
  onToggleDensity = () => {}
}) {
  return (
    <nav className={styles.navbar} aria-label="Primary">
      <div className={styles.navContainer}>
        <div className={styles.logo}>
          <span>clipboard</span>
        </div>
        
        <div className={styles.navActions}>
          <button type="button" onClick={onToggleDensity} className={styles.navButton} aria-label="Toggle between focus and lazy layout">
            {densityMode === 'focus' ? 'lazy' : 'focus'}
          </button>

          <button type="button" onClick={onShare} className={styles.navButton} aria-label="Copy room URL to clipboard">
            share
          </button>
          
          <button type="button" data-blendy-from="delete-room-modal" onClick={onDeleteRoom} className={styles.navButton} aria-label="Delete room and all contents">
            <span>delete</span>
          </button>
          
          <button type="button" onClick={onLogout} className={styles.navButton} aria-label="Log out of room">
            logout
          </button>
        </div>
      </div>
    </nav>
  );
}