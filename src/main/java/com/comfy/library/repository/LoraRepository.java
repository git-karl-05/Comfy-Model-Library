package com.comfy.library.repository;

import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoraRepository extends JpaRepository<LoraEntity, Long> {



    Page<LoraEntity> findByCategory(LoraCategory category, Pageable pageable);

    Page<LoraEntity> findByGroupNameIgnoreCase(String groupName, Pageable pageable);

    Page<LoraEntity> findByFavoriteTrue(Pageable pageable);

    Page<LoraEntity> findByLoraNameContainingIgnoreCase(String keyword, Pageable pageable);

    List<LoraEntity> findAllByOrderByGroupNameAsc();

    boolean existsBySha256(String sha256);

    Optional<LoraEntity> findBySha256(String sha256);

}